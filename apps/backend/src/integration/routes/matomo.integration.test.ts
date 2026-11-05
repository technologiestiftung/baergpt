import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { createClient, type Session } from "@supabase/supabase-js";
import type { Database } from "@repo/db-schema";
import app from "../../index";
import { config } from "../../config";
import { serviceRoleDbClient } from "../../supabase";
import { signInWithOtp } from "../fixtures/auth";
import {
	getCompletedMonthsWindow,
	resetMatomoStatsCacheForTests,
} from "../../routes/matomo";
import type { MatomoDashboardStats } from "../../types/matomo";

const supabaseAnonClient = createClient<Database>(
	config.supabaseUrl,
	config.supabaseAnonKey,
);

const MATOMO_URL = "https://matomo.example.com";
const originalFetch = globalThis.fetch;

function mockMatomoFetch(response: Response) {
	return vi
		.spyOn(globalThis, "fetch")
		.mockImplementation(async (input, init) => {
			const url = typeof input === "string" ? input : input.toString();
			if (url.startsWith(MATOMO_URL)) {
				return response;
			}
			return originalFetch(input, init);
		});
}

function matomoCallCount(fetchSpy: ReturnType<typeof vi.spyOn>) {
	return fetchSpy.mock.calls.filter(([input]) => {
		const url =
			typeof input === "string" ? input : (input as Request).toString();
		return url.startsWith(MATOMO_URL);
	}).length;
}

const UNAVAILABLE_STATS: MatomoDashboardStats = {
	available: false,
	averageSessionDurationSeconds: 0,
	profilePageViews: 0,
	deviceMonthlyTrend: [],
	osBreakdown: [],
	browserBreakdown: [],
};

const DEVICE_TREND_MONTH_STARTS = getCompletedMonthsWindow(new Date(), 6);

const MONTHLY_DEVICE_BREAKDOWNS = DEVICE_TREND_MONTH_STARTS.map((_, index) => [
	{ label: "Desktop", nb_visits: 10 * (index + 1) },
	{ label: "Smartphone", nb_visits: index + 1 },
	{ label: "Tablet", nb_visits: index },
]);

const SUCCESSFUL_BULK_RESPONSE = [
	{ avg_time_on_site: 123, nb_visits: 10 },
	[{ label: "/profile/", nb_hits: 42, nb_visits: 30 }],
	[
		{ label: "Windows", nb_visits: 60 },
		{ label: "macOS", nb_visits: 40 },
	],
	[
		{ label: "Chrome", nb_visits: 70 },
		{ label: "Firefox", nb_visits: 30 },
	],
	...MONTHLY_DEVICE_BREAKDOWNS,
];

const EXPECTED_SHAPED_STATS: MatomoDashboardStats = {
	available: true,
	averageSessionDurationSeconds: 123,
	profilePageViews: 42,
	deviceMonthlyTrend: DEVICE_TREND_MONTH_STARTS.map((month, index) => ({
		month,
		desktop: 10 * (index + 1),
		mobile: index + 1,
		tablet: index,
	})),
	osBreakdown: [
		{ label: "Windows", percentage: 60 },
		{ label: "macOS", percentage: 40 },
	],
	browserBreakdown: [
		{ label: "Chrome", percentage: 70 },
		{ label: "Firefox", percentage: 30 },
	],
};

describe("/admin/matomo-stats", () => {
	const givenAdminEmail = "matomo-test-suite-admin@ts.berlin";
	const givenUserEmail = "matomo-test-suite-user@ts.berlin";

	const userIds: Record<string, string> = {
		givenAdminEmail: "",
		givenUserEmail: "",
	};

	const users = [{ email: givenAdminEmail }, { email: givenUserEmail }];

	let adminSession: Session | null = null;
	let userSession: Session | null = null;

	const originalMatomoUrl = config.matomoUrl;
	const originalMatomoSiteId = config.matomoSiteId;
	const originalMatomoTokenAuth = config.matomoTokenAuth;

	beforeAll(async () => {
		for (const user of users) {
			const { data, error: signupError } =
				await serviceRoleDbClient.auth.admin.createUser({
					email: user.email,
					email_confirm: true,
					user_metadata: { first_name: "Test", last_name: "User" },
				});

			expect(signupError).toBeNull();

			userIds[user.email] = data.user.id;
		}

		const {
			data: { users: allUsers },
			error: listUsersError,
		} = await serviceRoleDbClient.auth.admin.listUsers();
		expect(listUsersError).toBeNull();

		const adminUser = allUsers.find(({ email }) => email === givenAdminEmail);

		const { error: setAdminError } = await serviceRoleDbClient
			.from("application_admins")
			.insert({ user_id: adminUser.id });

		expect(setAdminError).toBeNull();

		const { data: adminSignIn, error: adminSignInError } = await signInWithOtp(
			supabaseAnonClient,
			givenAdminEmail,
		);
		expect(adminSignInError).toBeNull();
		adminSession = adminSignIn.session;

		const { data: userSignIn, error: userSignInError } = await signInWithOtp(
			supabaseAnonClient,
			givenUserEmail,
		);
		expect(userSignInError).toBeNull();
		userSession = userSignIn.session;
	});

	beforeEach(() => {
		config.matomoUrl = MATOMO_URL;
		config.matomoSiteId = "1";
		config.matomoTokenAuth = "test-token-auth";
		resetMatomoStatsCacheForTests();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	afterAll(async () => {
		config.matomoUrl = originalMatomoUrl;
		config.matomoSiteId = originalMatomoSiteId;
		config.matomoTokenAuth = originalMatomoTokenAuth;
		resetMatomoStatsCacheForTests();

		for (const email of [givenAdminEmail, givenUserEmail]) {
			const userId = userIds[email];
			if (userId) {
				await serviceRoleDbClient.auth.admin.deleteUser(userId);
			}
		}
	});

	const requestMatomoStats = (session: Session | null) =>
		app.request("/admin/matomo-stats", {
			headers: new Headers({
				authorization: `Bearer ${session?.access_token}`,
			}),
		});

	it("returns a 403 if a non-admin user tries to access it", async () => {
		const response = await requestMatomoStats(userSession);

		expect(response.status).toBe(403);
	});

	it("returns the unavailable shape and never calls fetch when Matomo env vars are unset", async () => {
		config.matomoUrl = undefined;
		config.matomoSiteId = undefined;
		config.matomoTokenAuth = undefined;
		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async (input, init) => originalFetch(input, init));

		const response = await requestMatomoStats(adminSession);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual(UNAVAILABLE_STATS);
		expect(matomoCallCount(fetchSpy)).toBe(0);
	});

	it("returns correctly shaped stats on a successful Matomo response", async () => {
		mockMatomoFetch(
			new Response(JSON.stringify(SUCCESSFUL_BULK_RESPONSE), { status: 200 }),
		);

		const response = await requestMatomoStats(adminSession);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual(EXPECTED_SHAPED_STATS);
	});

	it("returns the unavailable shape (not a 5xx) when the Matomo response is non-ok", async () => {
		mockMatomoFetch(new Response(null, { status: 503 }));

		const response = await requestMatomoStats(adminSession);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual(UNAVAILABLE_STATS);
	});

	it("serves a second request within the TTL from cache without calling fetch again", async () => {
		const fetchSpy = mockMatomoFetch(
			new Response(JSON.stringify(SUCCESSFUL_BULK_RESPONSE), { status: 200 }),
		);

		const firstResponse = await requestMatomoStats(adminSession);
		const secondResponse = await requestMatomoStats(adminSession);

		expect(matomoCallCount(fetchSpy)).toBe(1);
		expect(await firstResponse.json()).toEqual(await secondResponse.json());
	});
});
