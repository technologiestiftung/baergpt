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

// Creates a confirmed user and returns its id, throwing (and narrowing the type) if
// creation failed — avoids non-null assertions on the nullable `data.user`.
async function createConfirmedUser(email: string): Promise<string> {
	const { data, error } = await serviceRoleDbClient.auth.admin.createUser({
		email,
		password,
		email_confirm: true,
	});
	if (error || !data.user) {
		throw error ?? new Error(`Failed to create test user ${email}`);
	}
	return data.user.id;
}

describe("domain allowlist RPCs", () => {
	const adminEmail = "domain-rpc-admin@ts.berlin"; // ts.berlin is an active seeded domain
	const addedDomain = "phase2-rpc-added.berlin.de";
	const testDomain = "phase2-rpc-test.berlin.de";
	let callerAdminId = "";
	let normalUserId = "";
	let domainAdminId = "";
	const createdUserIds: string[] = [];

	beforeAll(async () => {
		// Calling admin (at an already-allowed domain), used to invoke the RPCs.
		callerAdminId = await createConfirmedUser(adminEmail);
		await serviceRoleDbClient
			.from("application_admins")
			.insert({ user_id: callerAdminId });

		// Test domain (active) with one normal user and one admin user on it.
		await serviceRoleDbClient
			.from("allowed_email_domains")
			.insert({ domain: testDomain, is_active: true });

		normalUserId = await createConfirmedUser(`normal@${testDomain}`);

		domainAdminId = await createConfirmedUser(`admin@${testDomain}`);
		await serviceRoleDbClient
			.from("application_admins")
			.insert({ user_id: domainAdminId });

		// Sign in so the anon client carries the admin's JWT for the RPC calls.
		await anonClient.auth.signInWithPassword({ email: adminEmail, password });
	});

	afterAll(async () => {
		await anonClient.auth.signOut();
		for (const id of [
			callerAdminId,
			normalUserId,
			domainAdminId,
			...createdUserIds,
		]) {
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

	it("deactivate_allowed_domain deactivates non-admin users (no deleted_at), exempts admins, stamps last_status_change, and blocks new signups", async () => {
		const { data: count, error } = await anonClient.rpc(
			"deactivate_allowed_domain",
			{ p_domain: testDomain },
		);
		expect(error).toBeNull();
		expect(count).toBe(1); // only the normal user — the domain's admin is exempt

		const { data: domain } = await serviceRoleDbClient
			.from("allowed_email_domains")
			.select("is_active, last_status_change_at, last_status_change_by")
			.eq("domain", testDomain)
			.single();
		expect(domain?.is_active).toBe(false);
		expect(domain?.last_status_change_at).not.toBeNull();
		expect(domain?.last_status_change_by).toBe(callerAdminId);

		const { data: normal } = await serviceRoleDbClient
			.from("user_active_status")
			.select("is_active, deleted_at")
			.eq("id", normalUserId)
			.single();
		expect(normal?.is_active).toBe(false);
		expect(normal?.deleted_at).toBeNull(); // pure-deactivation, not purge-armed

		const { data: domainAdmin } = await serviceRoleDbClient
			.from("user_active_status")
			.select("is_active")
			.eq("id", domainAdminId)
			.single();
		expect(domainAdmin?.is_active).toBe(true); // admin exempt

		// New signups for the deactivated domain are now blocked by the trigger.
		const { error: signupError } =
			await serviceRoleDbClient.auth.admin.createUser({
				email: `blocked@${testDomain}`,
				password,
				email_confirm: true,
			});
		expect(signupError).not.toBeNull();
	});

	it("activate_allowed_domain re-enables the domain (stamps last_status_change) but does NOT reactivate users", async () => {
		const { error } = await anonClient.rpc("activate_allowed_domain", {
			p_domain: testDomain,
		});
		expect(error).toBeNull();

		const { data: domain } = await serviceRoleDbClient
			.from("allowed_email_domains")
			.select("is_active, last_status_change_by")
			.eq("domain", testDomain)
			.single();
		expect(domain?.is_active).toBe(true);
		expect(domain?.last_status_change_by).toBe(callerAdminId);

		// The previously-deactivated user stays inactive (no auto-reactivation).
		const { data: normal } = await serviceRoleDbClient
			.from("user_active_status")
			.select("is_active")
			.eq("id", normalUserId)
			.single();
		expect(normal?.is_active).toBe(false);

		// New signups are allowed again.
		const { data: created, error: signupError } =
			await serviceRoleDbClient.auth.admin.createUser({
				email: `fresh@${testDomain}`,
				password,
				email_confirm: true,
			});
		expect(signupError).toBeNull();
		if (created.user) {
			createdUserIds.push(created.user.id);
		}
	});

	it("rejects a non-admin (no session) caller", async () => {
		const noAuthClient = createClient<Database>(
			config.supabaseUrl,
			config.supabaseAnonKey,
		);
		const { error } = await noAuthClient.rpc("deactivate_allowed_domain", {
			p_domain: testDomain,
		});
		expect(error).not.toBeNull();
	});
});
