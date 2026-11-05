import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@repo/db-schema";
import { config } from "../config";
import { serviceRoleDbClient } from "../supabase";
import { signInWithOtp } from "./fixtures/auth";
import {
	planInactivityAction,
	readInactivityConfig,
	toBerlinDate,
	type InactiveUser,
} from "../services/inactive-user-service";

const INACTIVE_USER_ID = "a1a1a1a1-0000-4000-8000-000000000001";
const ACTIVE_USER_ID = "a1a1a1a1-0000-4000-8000-000000000002";
const BANNED_USER_ID = "a1a1a1a1-0000-4000-8000-000000000003";
const SESSION_USER_ID = "a1a1a1a1-0000-4000-8000-000000000004";
const UNCONFIRMED_USER_ID = "a1a1a1a1-0000-4000-8000-000000000005";
const INACTIVE_EMAIL = "inactive-users-inactive@ts.berlin";
const ACTIVE_EMAIL = "inactive-users-active@ts.berlin";
const BANNED_EMAIL = "inactive-users-banned@ts.berlin";
const SESSION_EMAIL = "inactive-users-session@ts.berlin";
const UNCONFIRMED_EMAIL = "inactive-users-unconfirmed@ts.berlin";
const TEST_USER_IDS = [
	INACTIVE_USER_ID,
	ACTIVE_USER_ID,
	BANNED_USER_ID,
	SESSION_USER_ID,
	UNCONFIRMED_USER_ID,
];

const TWO_YEARS_AGO = new Date(
	Date.now() - 2 * 365 * 24 * 60 * 60 * 1000,
).toISOString();
const inactivityConfig = readInactivityConfig({});

async function createUser(id: string, email: string, lastSignInAt: string) {
	const { error } = await serviceRoleDbClient.auth.admin.createUser({
		id,
		email,
		email_confirm: true,
		user_metadata: { first_name: "Test", last_name: "User" },
	});
	if (error && !/already (been )?registered/.test(error.message)) {
		throw error;
	}
	const { error: updateError } = await serviceRoleDbClient.rpc(
		"update_user_last_sign_in_at",
		{ user_id: id, new_last_sign_in_at: lastSignInAt },
	);
	if (updateError) {
		throw updateError;
	}
}

async function getInactiveUsers(): Promise<InactiveUser[]> {
	const { data, error } = await serviceRoleDbClient.rpc("get_inactive_users", {
		inactive_since: new Date(
			Date.now() - 365 * 24 * 60 * 60 * 1000,
		).toISOString(),
	});
	if (error) {
		throw error;
	}
	return (data as InactiveUser[]).filter((user) =>
		TEST_USER_IDS.includes(user.user_id),
	);
}

describe("get_inactive_users", () => {
	beforeAll(async () => {
		await createUser(INACTIVE_USER_ID, INACTIVE_EMAIL, TWO_YEARS_AGO);
		await createUser(ACTIVE_USER_ID, ACTIVE_EMAIL, new Date().toISOString());
		await createUser(BANNED_USER_ID, BANNED_EMAIL, TWO_YEARS_AGO);
		const { error } = await serviceRoleDbClient.auth.admin.updateUserById(
			BANNED_USER_ID,
			{ ban_duration: "87600h" },
		);
		if (error) {
			throw error;
		}
	});

	afterAll(async () => {
		for (const id of TEST_USER_IDS) {
			await serviceRoleDbClient.auth.admin.deleteUser(id);
		}
	});

	it("returns inactive users but not active or banned ones", async () => {
		const users = await getInactiveUsers();

		expect(users.map((user) => user.user_id)).toEqual([INACTIVE_USER_ID]);
		expect(users[0].email).toBe(INACTIVE_EMAIL);
		expect(new Date(users[0].last_active_at).toISOString()).toBe(TWO_YEARS_AGO);
	});

	it("does not return users with an unconfirmed email address", async () => {
		const { error } = await serviceRoleDbClient.auth.admin.createUser({
			id: UNCONFIRMED_USER_ID,
			email: UNCONFIRMED_EMAIL,
			email_confirm: false,
		});
		if (error && !/already (been )?registered/.test(error.message)) {
			throw error;
		}
		const { error: updateError } = await serviceRoleDbClient.rpc(
			"update_user_last_sign_in_at",
			{ user_id: UNCONFIRMED_USER_ID, new_last_sign_in_at: TWO_YEARS_AGO },
		);
		expect(updateError).toBeNull();

		const users = await getInactiveUsers();

		expect(users.map((user) => user.user_id)).not.toContain(
			UNCONFIRMED_USER_ID,
		);
	});

	it("counts an active session as activity", async () => {
		const client = createClient<Database>(
			config.supabaseUrl,
			config.supabaseAnonKey,
			{ auth: { persistSession: false } },
		);
		await createUser(SESSION_USER_ID, SESSION_EMAIL, TWO_YEARS_AGO);
		const { error: signInError } = await signInWithOtp(client, SESSION_EMAIL);
		expect(signInError).toBeNull();
		// Like a user who logged in long ago and has kept the session alive since
		await createUser(SESSION_USER_ID, SESSION_EMAIL, TWO_YEARS_AGO);
		const { error: refreshError } = await client.auth.refreshSession();
		expect(refreshError).toBeNull();

		const users = await getInactiveUsers();

		expect(users.map((user) => user.user_id)).not.toContain(SESSION_USER_ID);
	});

	it("returns banned users with a pending deletion, so it can be cancelled", async () => {
		const { error } = await serviceRoleDbClient
			.from("inactivity_notifications")
			.upsert({
				user_id: BANNED_USER_ID,
				last_active_at: TWO_YEARS_AGO,
				deletion_date: toBerlinDate(new Date()),
				warning_sent_at: new Date().toISOString(),
			});
		expect(error).toBeNull();

		const banned = (await getInactiveUsers()).find(
			(user) => user.user_id === BANNED_USER_ID,
		);

		expect(banned?.is_banned).toBe(true);
		expect(
			planInactivityAction(banned, inactivityConfig, toBerlinDate(new Date()))
				.type,
		).toBe("cancel");

		await serviceRoleDbClient
			.from("inactivity_notifications")
			.delete()
			.eq("user_id", BANNED_USER_ID);
	});

	it("is not accessible for anon or authenticated users", async () => {
		const client = createClient<Database>(
			config.supabaseUrl,
			config.supabaseAnonKey,
			{ auth: { persistSession: false } },
		);

		const { error: anonRpcError } = await client.rpc("get_inactive_users", {
			inactive_since: new Date().toISOString(),
		});
		expect(anonRpcError?.code).toBe("42501");

		const { error: signInError } = await signInWithOtp(client, ACTIVE_EMAIL);
		expect(signInError).toBeNull();

		const { error: rpcError } = await client.rpc("get_inactive_users", {
			inactive_since: new Date().toISOString(),
		});
		expect(rpcError?.code).toBe("42501");

		const { error: selectError } = await client
			.from("inactivity_notifications")
			.select("*");
		expect(selectError?.code).toBe("42501");
	});

	it("cancels a pending deletion after a login", async () => {
		const [warned] = await getInactiveUsers();
		const { error } = await serviceRoleDbClient
			.from("inactivity_notifications")
			.upsert({
				user_id: INACTIVE_USER_ID,
				last_active_at: warned.last_active_at,
				deletion_date: toBerlinDate(new Date()),
				warning_sent_at: new Date().toISOString(),
			});
		expect(error).toBeNull();

		const today = toBerlinDate(new Date());
		const [beforeLogin] = await getInactiveUsers();
		expect(
			planInactivityAction(beforeLogin, inactivityConfig, today).type,
		).toBe("delete");

		const client = createClient<Database>(
			config.supabaseUrl,
			config.supabaseAnonKey,
			{ auth: { persistSession: false } },
		);
		const { error: signInError } = await signInWithOtp(client, INACTIVE_EMAIL);
		expect(signInError).toBeNull();

		const afterLogin = (await getInactiveUsers()).find(
			(user) => user.user_id === INACTIVE_USER_ID,
		);
		expect(afterLogin).toBeDefined();
		expect(planInactivityAction(afterLogin, inactivityConfig, today).type).toBe(
			"cancel",
		);
	});
});
