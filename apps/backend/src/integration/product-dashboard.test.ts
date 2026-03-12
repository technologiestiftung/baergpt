import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { serviceRoleDbClient } from "../supabase";
import type { Database } from "@repo/db-schema";
import { subDays } from "date-fns";
import { createClient } from "@supabase/supabase-js";
import { config } from "../config";

type DailyUsers = {
	date: string;
	total: number;
	new: number;
};

type ProductDashboardStats = {
	daily_user_evolution: DailyUsers[];
	dau: number;
	wau: number;
	mau: number;
	domains: {
		count: number;
		domain: string;
	}[];
};

const TIMEOUT = 60_000;

const applicationAdminDbClient = createClient<Database>(
	config.supabaseUrl,
	config.supabaseAnonKey,
);

describe("get_product_dashboard_stats", () => {
	let givenUsers: Awaited<ReturnType<typeof registerManyUsers>>;

	const givenAdminId = crypto.randomUUID();
	const givenAdminEmail = "admin-test-suite-admin@local.berlin.de";
	const givenAdminPassword = "SecurePassword123!";

	beforeAll(async () => {
		await registerAdmin({
			id: givenAdminId,
			email: givenAdminEmail,
			password: givenAdminPassword,
		});

		await applicationAdminDbClient.auth.signInWithPassword({
			email: givenAdminEmail,
			password: givenAdminPassword,
		});

		givenUsers = await registerManyUsers();
	}, TIMEOUT);

	afterAll(async () => {
		await serviceRoleDbClient.auth.admin.deleteUser(givenAdminId);

		for (const user of givenUsers) {
			const { error } = await serviceRoleDbClient.auth.admin.deleteUser(
				user.id,
			);
			if (error) {
				expect(error).toBeNull();
			}
		}
	}, TIMEOUT);

	it("returns the expected top-level keys", async () => {
		const { data, error } = await applicationAdminDbClient.rpc(
			"get_product_dashboard_stats",
		);

		expect(error).toBeNull();
		expect(data).toBeDefined();
		expect(data).toHaveProperty("daily_user_evolution");
		expect(data).toHaveProperty("dau");
		expect(data).toHaveProperty("wau");
		expect(data).toHaveProperty("mau");
		expect(data).toHaveProperty("domains");
	});

	it("returns daily_user_evolution as an array of 30 days", async () => {
		const { data, error } = await applicationAdminDbClient.rpc(
			"get_product_dashboard_stats",
		);

		expect(error).toBeNull();
		expect(
			Array.isArray((data as ProductDashboardStats).daily_user_evolution),
		).toBe(true);
		expect((data as ProductDashboardStats).daily_user_evolution).toHaveLength(
			30,
		);
	});

	it("each daily_user_evolution entry has date, total, and new fields", async () => {
		const { data, error } = await applicationAdminDbClient.rpc(
			"get_product_dashboard_stats",
		);

		expect(error).toBeNull();
		for (const entry of (data as ProductDashboardStats).daily_user_evolution) {
			expect(entry).toHaveProperty("date");
			expect(entry).toHaveProperty("total");
			expect(entry).toHaveProperty("new");
			expect(typeof entry.total).toBe("number");
			expect(typeof entry.new).toBe("number");
			expect(entry.new).toBeLessThanOrEqual(entry.total);
		}
	});

	it("dau, wau, mau are non-negative numbers", async () => {
		const { data, error } = await applicationAdminDbClient.rpc(
			"get_product_dashboard_stats",
		);

		expect(error).toBeNull();
		expect(typeof (data as ProductDashboardStats).dau).toBe("number");
		expect(typeof (data as ProductDashboardStats).wau).toBe("number");
		expect(typeof (data as ProductDashboardStats).mau).toBe("number");
		expect((data as ProductDashboardStats).dau).toBeGreaterThanOrEqual(0);
		expect((data as ProductDashboardStats).wau).toBeGreaterThanOrEqual(0);
		expect((data as ProductDashboardStats).mau).toBeGreaterThanOrEqual(0);
	});

	it("dau <= wau <= mau (activity windows are cumulative)", async () => {
		const { data, error } = await applicationAdminDbClient.rpc(
			"get_product_dashboard_stats",
		);

		expect(error).toBeNull();
		expect((data as ProductDashboardStats).dau).toBeLessThanOrEqual(
			(data as ProductDashboardStats).wau,
		);
		expect((data as ProductDashboardStats).wau).toBeLessThanOrEqual(
			(data as ProductDashboardStats).mau,
		);
	});

	it("domains is an array and each entry has domain and count", async () => {
		const { data, error } = await applicationAdminDbClient.rpc(
			"get_product_dashboard_stats",
		);

		expect(error).toBeNull();
		expect(Array.isArray((data as ProductDashboardStats).domains)).toBe(true);
		expect((data as ProductDashboardStats).domains.length).toBeGreaterThan(0);
		for (const entry of (data as ProductDashboardStats).domains) {
			expect(entry).toHaveProperty("domain");
			expect(entry).toHaveProperty("count");
			expect(typeof entry.domain).toBe("string");
			expect(typeof entry.count).toBe("number");
			expect(entry.count).toBeGreaterThan(0);
		}
	});
});

async function registerAdmin(params: {
	id: string;
	email: string;
	password: string;
}) {
	const { id, email, password } = params;

	const { error: createUserError } =
		await serviceRoleDbClient.auth.admin.createUser({
			id,
			email,
			password,
			email_confirm: true,
		});

	if (createUserError) {
		expect(createUserError).toBeNull();
	}

	const { error: setAdminError } = await serviceRoleDbClient
		.from("application_admins")
		.insert({ user_id: id });

	expect(setAdminError).toBeNull();
}

function pickRandom(domains: string[]): string {
	return domains[Math.floor(Math.random() * domains.length)];
}

async function registerManyUsers() {
	const { data, error } = await serviceRoleDbClient
		.from("allowed_email_domains")
		.select("domain");

	if (error) {
		expect(error).toBeNull();
	}

	const domains = data.map((entry) => entry.domain);

	const domainsWithoutWildcard = domains.filter(
		(domain) => !domain.includes("*"),
	);

	const users = [];
	const days = 30;
	let maxUsersPerDay = 1;

	for (let dayIndex = 1; dayIndex < days; dayIndex++) {
		for (let usersPerDay = 1; usersPerDay <= maxUsersPerDay; usersPerDay++) {
			const today = new Date();

			const randomDay = subDays(today, Math.floor(Math.random() * dayIndex));

			const creationDate = subDays(today, dayIndex);

			users.push({
				id: crypto.randomUUID(),
				email: `${dayIndex}-${usersPerDay}@${pickRandom(domainsWithoutWildcard)}`,
				password: "password",
				creationDate,
				lastSignIn: randomDay,
			});
		}
		maxUsersPerDay++;
	}

	for (const user of users) {
		const { error: createUserError } =
			await serviceRoleDbClient.auth.admin.createUser({
				id: user.id,
				email: user.email,
				password: user.password,
				email_confirm: true,
			});

		if (createUserError) {
			expect(createUserError).toBeNull();
		}

		const { error: updateUserError1 } = await serviceRoleDbClient.rpc(
			"update_user_email_confirmed_at",
			{
				user_id: user.id,
				new_email_confirmed_at: user.creationDate.toISOString(),
			},
		);

		if (updateUserError1) {
			expect(updateUserError1).toBeNull();
		}

		const { error: updateUserError2 } = await serviceRoleDbClient.rpc(
			"update_user_last_sign_in_at",
			{
				user_id: user.id,
				new_last_sign_in_at: user.lastSignIn.toISOString(),
			},
		);

		if (updateUserError2) {
			expect(updateUserError2).toBeNull();
		}
	}

	return users;
}
