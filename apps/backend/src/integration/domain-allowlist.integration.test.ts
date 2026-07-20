import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@repo/db-schema";
import { config } from "../config";
import { serviceRoleDbClient } from "../supabase";

// The domain RPCs self-authorize via auth.uid(), so they're called with a signed-in
// admin (anon client + JWT), not the service-role client. Assertions read back through
// the service-role client (bypasses RLS on user_active_status / allowed_email_domains).
const anonClient = createClient<Database>(
	config.supabaseUrl,
	config.supabaseAnonKey,
);

const password = "SecurePassword123!";

// Creates a confirmed user with a fixed id, throwing (and narrowing the type) if
// creation failed — avoids non-null assertions on the nullable `data.user`.
async function createConfirmedUser(email: string, id: string): Promise<void> {
	const { error } = await serviceRoleDbClient.auth.admin.createUser({
		id,
		email,
		password,
		email_confirm: true,
	});
	if (error) {
		throw error;
	}
}

describe("domain allowlist RPCs", () => {
	const adminEmail = "domain-rpc-admin@ts.berlin"; // ts.berlin is an active seeded domain
	const nonAdminEmail = "domain-rpc-nonadmin@ts.berlin";
	const addedDomain = "phase2-rpc-added.berlin.de";
	const testDomain = "phase2-rpc-test.berlin.de";

	// Fixed ids so a crashed run's leftovers can be deleted (by id) before re-creating
	const callerAdminId = "a1b2c3d4-0000-4000-8000-000000000001";
	const normalUserId = "a1b2c3d4-0000-4000-8000-000000000002";
	const domainAdminId = "a1b2c3d4-0000-4000-8000-000000000003";
	const nonAdminUserId = "a1b2c3d4-0000-4000-8000-000000000004";
	const freshUserId = "a1b2c3d4-0000-4000-8000-000000000005"; // created when re-testing signup
	const allUserIds = [
		callerAdminId,
		normalUserId,
		domainAdminId,
		nonAdminUserId,
		freshUserId,
	];

	beforeAll(async () => {
		// Remove any leftovers from an interrupted run before recreating.
		for (const id of allUserIds) {
			await serviceRoleDbClient.auth.admin.deleteUser(id);
		}
		await serviceRoleDbClient
			.from("allowed_email_domains")
			.delete()
			.in("domain", [testDomain, addedDomain]);

		// Calling admin (at an already-allowed domain), used to invoke the RPCs.
		await createConfirmedUser(adminEmail, callerAdminId);
		await serviceRoleDbClient
			.from("application_admins")
			.insert({ user_id: callerAdminId });

		// Test domain (active) with one normal user and one admin user on it.
		await serviceRoleDbClient
			.from("allowed_email_domains")
			.insert({ domain: testDomain, is_active: true });

		await createConfirmedUser(`normal@${testDomain}`, normalUserId);

		await createConfirmedUser(`admin@${testDomain}`, domainAdminId);
		await serviceRoleDbClient
			.from("application_admins")
			.insert({ user_id: domainAdminId });

		// Authenticated non-admin user (on the admin's domain)
		await createConfirmedUser(nonAdminEmail, nonAdminUserId);

		// Sign in so the anon client carries the admin's JWT for the RPC calls.
		await anonClient.auth.signInWithPassword({ email: adminEmail, password });
	});

	afterAll(async () => {
		await anonClient.auth.signOut();
		for (const id of allUserIds) {
			await serviceRoleDbClient.auth.admin.deleteUser(id);
		}
		await serviceRoleDbClient
			.from("allowed_email_domains")
			.delete()
			.in("domain", [testDomain, addedDomain]);
	});

	it("add_allowed_domain adds an active domain, stamped with created_by and no status change", async () => {
		const { error } = await anonClient.rpc("add_allowed_domain", {
			p_domain: addedDomain,
		});
		expect(error).toBeNull();

		const { data } = await serviceRoleDbClient
			.from("allowed_email_domains")
			.select(
				"is_active, created_by, last_status_change_at, last_status_change_by",
			)
			.eq("domain", addedDomain)
			.single();
		expect(data?.is_active).toBe(true);
		expect(data?.created_by).toBe(callerAdminId);
		expect(data?.last_status_change_at).toBeNull();
		expect(data?.last_status_change_by).toBeNull();
	});

	it("add_allowed_domain rejects malformed domains via the exact-format CHECK constraint", async () => {
		for (const bad of ["*.berlin.de", "not-a-valid-domain"]) {
			const { error } = await anonClient.rpc("add_allowed_domain", {
				p_domain: bad,
			});
			expect(error, `expected "${bad}" to be rejected`).not.toBeNull();
		}
	});

	it("get_allowed_email_domains_admin lists domains with derived creator email and user_count", async () => {
		const listedDomain = "phase2-rpc-listed.berlin.de";
		const { error: addError } = await anonClient.rpc("add_allowed_domain", {
			p_domain: listedDomain,
		});
		expect(addError).toBeNull();

		try {
			const { data, error } = await anonClient.rpc(
				"get_allowed_email_domains_admin",
			);
			expect(error).toBeNull();

			// Just-added domain: created_by is the creator's email (not the uuid),
			// and no users sit on it yet. Verifies the zero/derived-email path.
			const created = data?.find((entry) => entry.domain === listedDomain);
			expect(created?.is_active).toBe(true);
			expect(created?.created_by).toBe(adminEmail);
			expect(created?.user_count).toBe(0);

			// testDomain has two users (normal@ + admin@). Verifies the count aggregation.
			const testEntry = data?.find((entry) => entry.domain === testDomain);
			expect(testEntry?.user_count).toBe(2);
		} finally {
			await serviceRoleDbClient
				.from("allowed_email_domains")
				.delete()
				.eq("domain", listedDomain);
		}
	});

	it("get_allowed_email_domains (registration-facing) returns only active domains", async () => {
		const activeDomain = "phase2-rpc-pub-active.berlin.de";
		const inactiveDomain = "phase2-rpc-pub-inactive.berlin.de";
		await serviceRoleDbClient.from("allowed_email_domains").insert([
			{ domain: activeDomain, is_active: true },
			{ domain: inactiveDomain, is_active: false },
		]);

		try {
			const { data, error } = await anonClient.rpc("get_allowed_email_domains");
			expect(error).toBeNull();

			const domains = data?.map((entry) => entry.domain) ?? [];
			expect(domains).toContain(activeDomain);
			expect(domains).not.toContain(inactiveDomain);
		} finally {
			await serviceRoleDbClient
				.from("allowed_email_domains")
				.delete()
				.in("domain", [activeDomain, inactiveDomain]);
		}
	});

	it("deactivate_allowed_domain and activate_allowed_domain handle full lifecycle without reactivating users", async () => {
		const { data: count, error } = await anonClient.rpc(
			"deactivate_allowed_domain",
			{ p_domain: testDomain },
		);
		expect(error).toBeNull();
		expect(count).toBe(2);

		const { data: domain } = await serviceRoleDbClient
			.from("allowed_email_domains")
			.select("is_active, last_status_change_at, last_status_change_by")
			.eq("domain", testDomain)
			.single();
		expect(domain?.is_active).toBe(false);
		expect(domain?.last_status_change_at).not.toBeNull();
		expect(domain?.last_status_change_by).toBe(callerAdminId);

		const { data: getNormalUserData1, error: getNormalUserDataError1 } =
			await serviceRoleDbClient.auth.admin.getUserById(normalUserId);
		expect(getNormalUserDataError1).toBeNull();
		// @ts-expect-error: banned_until is not typed, but it can be there
		expect(getNormalUserData1.user.banned_until).toBeDefined();

		const { data: getAdminUserData1, error: getAdminUserError1 } =
			await serviceRoleDbClient.auth.admin.getUserById(domainAdminId);
		expect(getAdminUserError1).toBeNull();
		// @ts-expect-error: banned_until is not typed, but it can be there
		expect(getAdminUserData1.user.banned_until).toBeDefined();

		// New signups for the deactivated domain are now blocked by the trigger.
		const { error: signupError } =
			await serviceRoleDbClient.auth.admin.createUser({
				email: `blocked@${testDomain}`,
				password,
				email_confirm: true,
			});
		expect(signupError).not.toBeNull();

		const { error: activateError } = await anonClient.rpc(
			"activate_allowed_domain",
			{
				p_domain: testDomain,
			},
		);
		expect(activateError).toBeNull();

		const { data: reactivatedDomain } = await serviceRoleDbClient
			.from("allowed_email_domains")
			.select("is_active, last_status_change_by")
			.eq("domain", testDomain)
			.single();
		expect(reactivatedDomain?.is_active).toBe(true);
		expect(reactivatedDomain?.last_status_change_by).toBe(callerAdminId);

		// The previously-deactivated users stays inactive (no auto-reactivation).
		const { data: getNormalUserData2, error: getNormalUserDataError2 } =
			await serviceRoleDbClient.auth.admin.getUserById(normalUserId);
		expect(getNormalUserDataError2).toBeNull();
		// @ts-expect-error: banned_until is not typed, but it can be there
		expect(getNormalUserData2.user.banned_until).toBeDefined();

		const { data: getAdminUserData2, error: getAdminUserError2 } =
			await serviceRoleDbClient.auth.admin.getUserById(domainAdminId);
		expect(getAdminUserError2).toBeNull();
		// @ts-expect-error: banned_until is not typed, but it can be there
		expect(getAdminUserData2.user.banned_until).toBeDefined();

		// New signups are allowed again.
		const { error: signupAllowedError } =
			await serviceRoleDbClient.auth.admin.createUser({
				id: freshUserId,
				email: `fresh@${testDomain}`,
				password,
				email_confirm: true,
			});
		expect(signupAllowedError).toBeNull();
	});

	it("rejects an authenticated non-admin caller on every admin RPC", async () => {
		const nonAdminClient = createClient<Database>(
			config.supabaseUrl,
			config.supabaseAnonKey,
		);
		await nonAdminClient.auth.signInWithPassword({
			email: nonAdminEmail,
			password,
		});

		const results = await Promise.all([
			nonAdminClient.rpc("get_allowed_email_domains_admin"),
			nonAdminClient.rpc("add_allowed_domain", {
				p_domain: "rejected.berlin.de",
			}),
			nonAdminClient.rpc("activate_allowed_domain", { p_domain: testDomain }),
			nonAdminClient.rpc("deactivate_allowed_domain", { p_domain: testDomain }),
		]);
		for (const { error } of results) {
			expect(error).not.toBeNull();
		}

		await nonAdminClient.auth.signOut();
	});

	it("does not expose allowed_email_domains to non-admins via direct table read (RLS)", async () => {
		const nonAdminClient = createClient<Database>(
			config.supabaseUrl,
			config.supabaseAnonKey,
		);
		await nonAdminClient.auth.signInWithPassword({
			email: nonAdminEmail,
			password,
		});

		const { data, error } = await nonAdminClient
			.from("allowed_email_domains")
			.select("*");
		expect(error).toBeNull();
		expect(data).toStrictEqual([]);

		await nonAdminClient.auth.signOut();
	});
});
