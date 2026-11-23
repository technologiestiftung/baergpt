import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@repo/db-schema";
import { config } from "../config";
import { serviceRoleDbClient } from "../supabase";
import { signInWithOtp } from "./fixtures/auth";
import { file_size, num_pages } from "./fixtures/constants";
import { PrivilegedDbService } from "../services/db-service/privileged-db-service";
import {
	addDays,
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
const SIGNED_OUT_USER_ID = "a1a1a1a1-0000-4000-8000-000000000006";
const DELETED_USER_ID = "a1a1a1a1-0000-4000-8000-000000000007";
const PENDING_USER_ID = "a1a1a1a1-0000-4000-8000-000000000008";
const INACTIVE_EMAIL = "inactive-users-inactive@ts.berlin";
const ACTIVE_EMAIL = "inactive-users-active@ts.berlin";
const BANNED_EMAIL = "inactive-users-banned@ts.berlin";
const SESSION_EMAIL = "inactive-users-session@ts.berlin";
const UNCONFIRMED_EMAIL = "inactive-users-unconfirmed@ts.berlin";
const SIGNED_OUT_EMAIL = "inactive-users-signed-out@ts.berlin";
const DELETED_EMAIL = "inactive-users-deleted@ts.berlin";
const PENDING_EMAIL = "inactive-users-pending@ts.berlin";
const TEST_USER_IDS = [
	INACTIVE_USER_ID,
	ACTIVE_USER_ID,
	BANNED_USER_ID,
	SESSION_USER_ID,
	UNCONFIRMED_USER_ID,
	SIGNED_OUT_USER_ID,
	DELETED_USER_ID,
	PENDING_USER_ID,
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

	it("keeps the session activity after a sign-out", async () => {
		const client = createClient<Database>(
			config.supabaseUrl,
			config.supabaseAnonKey,
			{ auth: { persistSession: false } },
		);
		await createUser(SIGNED_OUT_USER_ID, SIGNED_OUT_EMAIL, TWO_YEARS_AGO);
		const { error: signInError } = await signInWithOtp(
			client,
			SIGNED_OUT_EMAIL,
		);
		expect(signInError).toBeNull();
		await createUser(SIGNED_OUT_USER_ID, SIGNED_OUT_EMAIL, TWO_YEARS_AGO);
		const { error: refreshError } = await client.auth.refreshSession();
		expect(refreshError).toBeNull();
		const { error: signOutError } = await client.auth.signOut();
		expect(signOutError).toBeNull();

		const users = await getInactiveUsers();

		expect(users.map((user) => user.user_id)).not.toContain(SIGNED_OUT_USER_ID);
	});

	it("deletes users with a session without keeping their activity", async () => {
		const client = createClient<Database>(
			config.supabaseUrl,
			config.supabaseAnonKey,
			{ auth: { persistSession: false } },
		);
		await createUser(DELETED_USER_ID, DELETED_EMAIL, TWO_YEARS_AGO);
		const { error: signInError } = await signInWithOtp(client, DELETED_EMAIL);
		expect(signInError).toBeNull();

		const { error: deleteError } =
			await serviceRoleDbClient.auth.admin.deleteUser(DELETED_USER_ID);
		expect(deleteError).toBeNull();

		const { data, error } = await serviceRoleDbClient
			.from("user_session_activity")
			.select("user_id")
			.eq("user_id", DELETED_USER_ID);
		expect(error).toBeNull();
		expect(data).toEqual([]);
	});

	it("returns banned users with a pending deletion, so it can be cancelled", async () => {
		const { error } = await serviceRoleDbClient
			.from("inactivity_notifications")
			.upsert({
				user_id: BANNED_USER_ID,
				last_active_at: TWO_YEARS_AGO,
				deletion_date: addDays(toBerlinDate(new Date()), -1),
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

		const { error: deleteRpcError } = await client.rpc("delete_inactive_user", {
			target_user_id: INACTIVE_USER_ID,
			expected_last_active_at: TWO_YEARS_AGO,
			expected_deletion_date: toBerlinDate(new Date()),
		});
		expect(deleteRpcError?.code).toBe("42501");
	});

	it("cancels a pending deletion after a login", async () => {
		const [warned] = await getInactiveUsers();
		const { error } = await serviceRoleDbClient
			.from("inactivity_notifications")
			.upsert({
				user_id: INACTIVE_USER_ID,
				last_active_at: warned.last_active_at,
				deletion_date: addDays(toBerlinDate(new Date()), -1),
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

describe("delete_inactive_user", () => {
	const deletionDate = addDays(toBerlinDate(new Date()), -1);

	async function schedulePendingDeletion() {
		await createUser(PENDING_USER_ID, PENDING_EMAIL, TWO_YEARS_AGO);
		const { error } = await serviceRoleDbClient
			.from("inactivity_notifications")
			.upsert({
				user_id: PENDING_USER_ID,
				last_active_at: TWO_YEARS_AGO,
				deletion_date: deletionDate,
				warning_sent_at: new Date().toISOString(),
			});
		if (error) {
			throw error;
		}
	}

	async function deleteInactiveUser(
		lastActiveAt = TWO_YEARS_AGO,
		expectedDeletionDate = deletionDate,
	) {
		const { data, error } = await serviceRoleDbClient.rpc(
			"delete_inactive_user",
			{
				target_user_id: PENDING_USER_ID,
				expected_last_active_at: lastActiveAt,
				expected_deletion_date: expectedDeletionDate,
			},
		);
		expect(error).toBeNull();
		return data[0].deleted;
	}

	async function userExists() {
		const { data } =
			await serviceRoleDbClient.auth.admin.getUserById(PENDING_USER_ID);
		return data.user !== null;
	}

	afterAll(async () => {
		await serviceRoleDbClient.auth.admin.deleteUser(PENDING_USER_ID);
	});

	it("keeps users without a pending deletion", async () => {
		await createUser(PENDING_USER_ID, PENDING_EMAIL, TWO_YEARS_AGO);
		await serviceRoleDbClient
			.from("inactivity_notifications")
			.delete()
			.eq("user_id", PENDING_USER_ID);

		expect(await deleteInactiveUser()).toBe(false);
		expect(await userExists()).toBe(true);
	});

	it("keeps users whose deletion was rescheduled", async () => {
		await schedulePendingDeletion();

		expect(
			await deleteInactiveUser(TWO_YEARS_AGO, toBerlinDate(new Date())),
		).toBe(false);
		expect(await userExists()).toBe(true);
	});

	it("keeps users who were active since the deletion was planned", async () => {
		await schedulePendingDeletion();

		expect(await deleteInactiveUser(new Date(0).toISOString())).toBe(false);
		expect(await userExists()).toBe(true);
	});

	it("keeps banned users", async () => {
		await schedulePendingDeletion();
		await serviceRoleDbClient.auth.admin.updateUserById(PENDING_USER_ID, {
			ban_duration: "87600h",
		});

		try {
			expect(await deleteInactiveUser()).toBe(false);
			expect(await userExists()).toBe(true);
		} finally {
			await serviceRoleDbClient.auth.admin.updateUserById(PENDING_USER_ID, {
				ban_duration: "none",
			});
		}
	});

	it("deletes unchanged users with a pending deletion", async () => {
		await schedulePendingDeletion();

		expect(await deleteInactiveUser()).toBe(true);
		expect(await userExists()).toBe(false);
	});

	it("removes the storage files of deleted users", async () => {
		await schedulePendingDeletion();
		const sourceUrl = `${PENDING_USER_ID}/inactive.docx`;
		const previewUrl = `${PENDING_USER_ID}/inactive.pdf`;
		for (const path of [sourceUrl, previewUrl]) {
			const { error } = await serviceRoleDbClient.storage
				.from("documents")
				.upload(path, new Blob(["test"], { type: "application/pdf" }), {
					upsert: true,
				});
			expect(error).toBeNull();
		}
		const { error: insertError } = await serviceRoleDbClient
			.from("documents")
			.insert({
				owned_by_user_id: PENDING_USER_ID,
				source_type: "personal_document",
				source_url: sourceUrl,
				file_name: "inactive.docx",
				file_checksum: crypto.randomUUID(),
				file_size,
				num_pages,
			});
		expect(insertError).toBeNull();

		const deleted = await new PrivilegedDbService(
			serviceRoleDbClient,
		).deleteInactiveUser(PENDING_USER_ID, {
			lastActiveAt: TWO_YEARS_AGO,
			deletionDate,
		});

		expect(deleted).toBe(true);
		expect(await userExists()).toBe(false);
		const { data: files } = await serviceRoleDbClient.storage
			.from("documents")
			.list(PENDING_USER_ID);
		expect(files).toEqual([]);
	});
});
