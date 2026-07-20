import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "vitest";
import { createClient, type Session, type User } from "@supabase/supabase-js";
import type { Database } from "@repo/db-schema";
import app from "../../index";
import { config } from "../../config";
import { serviceRoleDbClient } from "../../supabase";

const supabaseAnonClient = createClient<Database>(
	config.supabaseUrl,
	config.supabaseAnonKey,
);

describe("/admin/", () => {
	const givenAdminEmail = "admin-test-suite-admin@ts.berlin";
	const givenAdminPassword = "SecurePassword123!";

	const givenUserEmail = "admin-test-suite-user@ts.berlin";
	const givenUserPassword = "SecurePassword123!";

	const userIds: Record<string, string> = {
		givenAdminEmail: "",
		givenUserEmail: "",
	};

	const users = [
		{ email: givenAdminEmail, password: givenAdminPassword },
		{ email: givenUserEmail, password: givenUserPassword },
	];

	let adminSession: Session | null = null;

	beforeAll(async () => {
		for (const user of users) {
			const { data, error: signupError } =
				await serviceRoleDbClient.auth.admin.createUser({
					email: user.email,
					password: user.password,
					email_confirm: true,
				});

			expect(signupError).toBeNull();

			userIds[user.email] = data.user.id;
		}

		const {
			data: { users: adminUsers },
			error: listUsersError,
		} = await serviceRoleDbClient.auth.admin.listUsers();
		expect(listUsersError).toBeNull();

		const adminUser = adminUsers.find(({ email }) => email === givenAdminEmail);

		const { error: setAdminError } = await serviceRoleDbClient
			.from("application_admins")
			.insert({ user_id: adminUser.id });

		expect(setAdminError).toBeNull();
	});

	beforeEach(async () => {
		const { data, error } = await supabaseAnonClient.auth.signInWithPassword({
			email: givenAdminEmail,
			password: givenAdminPassword,
		});

		expect(error).toBeNull();
		expect(data.session).toBeDefined();

		adminSession = data.session;
	});

	afterEach(async () => {
		const { error } = await supabaseAnonClient.auth.signOut();

		expect(error).toBeNull();

		adminSession = null;
	});

	afterAll(async () => {
		const { data, error } = await serviceRoleDbClient.auth.admin.listUsers({});

		expect(error).toBeNull();

		for (const user of data.users) {
			/**
			 * Only delete the users created by this test suite,
			 * ignore any other users that might exist in the database.
			 */
			if (![givenAdminEmail, givenUserEmail].includes(user.email)) {
				continue;
			}

			const { error: deleteError } =
				await serviceRoleDbClient.auth.admin.deleteUser(user.id);
			expect(deleteError).toBeNull();
		}
	});

	it("PUT /admin/users/:userId/profile should update user profile and return 200", async () => {
		const givenUpdatedUser = {
			email: "updated@ts.berlin",
			academic_title: "Dr.",
			personal_title: "UpdatedTitle",
			firstName: "UpdatedFirstName",
			lastName: "UpdatedLastName",
		};
		const givenUserId = userIds[givenUserEmail];

		const response = await app.request(`/admin/users/${givenUserId}/profile`, {
			method: "PUT",
			headers: new Headers({
				authorization: `Bearer ${adminSession?.access_token}`,
			}),
			body: JSON.stringify(givenUpdatedUser),
		});

		const responseBody = await response.json();

		expect(response.status).toBe(200);
		expect(responseBody.message).toBe("Profile updated successfully");

		const {
			data: { users: updatedUsers },
			error: listUsersError,
		} = await serviceRoleDbClient.auth.admin.listUsers();
		expect(listUsersError).toBeNull();

		const { data: profile, error: getUserError } = await serviceRoleDbClient
			.from("profiles")
			.select("*")
			.eq("id", givenUserId)
			.single();
		expect(getUserError).toBeNull();

		const user = updatedUsers.find(({ id }) => id === givenUserId);

		const actualUser = {
			email: user.email,
			academic_title: profile.academic_title,
			personal_title: profile.personal_title,
			firstName: profile.first_name,
			lastName: profile.last_name,
		};

		expect(actualUser).toStrictEqual(givenUpdatedUser);

		/**
		 * revert the changes
		 */
		const revertResponse = await app.request(
			`/admin/users/${givenUserId}/profile`,
			{
				method: "PUT",
				headers: new Headers({
					authorization: `Bearer ${adminSession?.access_token}`,
				}),
				body: JSON.stringify({ email: givenUserEmail }),
			},
		);

		const revertResponseBody = await revertResponse.json();

		expect(revertResponse.status).toBe(200);
		expect(revertResponseBody.message).toBe("Profile updated successfully");
	});

	it("PUT /admin/users/:userId/profile should return a 403 if a non admin user tries to access it", async () => {
		const { data, error } = await supabaseAnonClient.auth.signInWithPassword({
			email: givenUserEmail,
			password: givenUserPassword,
		});

		expect(error).toBeNull();
		expect(data.session).toBeDefined();

		const userSession = data.session;

		const response = await app.request(
			`/admin/users/${data.session.user.id}/profile`,
			{
				method: "PUT",
				headers: new Headers({
					authorization: `Bearer ${userSession.access_token}`,
				}),
			},
		);

		expect(response.status).toBe(403);
	});

	it("PUT /admin/users/:userId/admin should update user admin status and return 200", async () => {
		const givenUserId = userIds[givenUserEmail];
		const isAdmin = true;

		const response = await app.request(`/admin/users/${givenUserId}/admin`, {
			method: "PUT",
			headers: new Headers({
				authorization: `Bearer ${adminSession?.access_token}`,
			}),
			body: JSON.stringify({ isAdmin }),
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			message: "User admin status updated successfully",
		});

		const { count } = await serviceRoleDbClient
			.from("application_admins")
			.select("*", { count: "exact", head: true })
			.eq("user_id", givenUserId);

		const expected = count === 1;

		expect(expected).toBe(true);

		// revert the changes
		const { error } = await serviceRoleDbClient
			.from("application_admins")
			.delete()
			.eq("user_id", givenUserId);
		expect(error).toBeNull();
	});

	it("PUT /admin/users/:userId/admin should return a 403 if a non admin user tries to access it", async () => {
		const { data, error } = await supabaseAnonClient.auth.signInWithPassword({
			email: givenUserEmail,
			password: givenUserPassword,
		});

		expect(error).toBeNull();
		expect(data.session).toBeDefined();

		const userSession = data.session;

		const response = await app.request(
			`/admin/users/${data.session.user.id}/admin`,
			{
				method: "PUT",
				headers: new Headers({
					authorization: `Bearer ${userSession.access_token}`,
				}),
			},
		);

		expect(response.status).toBe(403);
	});

	it("PUT /admin/users/:userId/ban should ban a user and return 200", async () => {
		const givenUserId = userIds[givenUserEmail];

		const response = await app.request(`/admin/users/${givenUserId}/ban`, {
			method: "PUT",
			headers: new Headers({
				authorization: `Bearer ${adminSession?.access_token}`,
			}),
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			message: "User banned successfully",
		});

		const { data: getBannedUserData, error: getBannedUserError } =
			await serviceRoleDbClient.auth.admin.getUserById(givenUserId);
		expect(getBannedUserError).toBeNull();
		// @ts-expect-error: banned_until is not typed, but it can be there
		expect(getBannedUserData.user.banned_until).toBeDefined();

		const { data, error } = await serviceRoleDbClient.auth.admin.updateUserById(
			givenUserId,
			{
				ban_duration: "none", // remove the ban
			},
		);
		expect(error).toBeNull();
		// @ts-expect-error: banned_until is not typed, but it can be there
		expect(data.user.banned_until).toBeUndefined();
	});

	it("PUT /admin/users/:userId/ban should return a 403 if a non admin user tries to access it", async () => {
		const { data, error } = await supabaseAnonClient.auth.signInWithPassword({
			email: givenUserEmail,
			password: givenUserPassword,
		});

		expect(error).toBeNull();
		expect(data.session).toBeDefined();

		const userSession = data.session;

		const response = await app.request(
			`/admin/users/${data.session.user.id}/ban`,
			{
				method: "PUT",
				headers: new Headers({
					authorization: `Bearer ${userSession.access_token}`,
				}),
			},
		);

		expect(response.status).toBe(403);
	});

	it("PUT /admin/users/:userId/unban should unban user and return 200", async () => {
		const givenUserId = userIds[givenUserEmail];

		const { data, error } = await serviceRoleDbClient.auth.admin.updateUserById(
			givenUserId,
			{
				ban_duration: "876000h", // ~100 years = effectively permanent
			},
		);
		expect(error).toBeNull();
		// @ts-expect-error: banned_until is not typed, but it can be there
		expect(data.user.banned_until).toBeDefined();

		const response = await app.request(`/admin/users/${givenUserId}/unban`, {
			method: "PUT",
			headers: new Headers({
				authorization: `Bearer ${adminSession?.access_token}`,
			}),
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			message: "User unbanned successfully",
		});

		const { data: getUnbannedUserData, error: getUnbannedUserError } =
			await serviceRoleDbClient.auth.admin.getUserById(givenUserId);
		expect(getUnbannedUserError).toBeNull();
		// @ts-expect-error: banned_until is not typed, but it can be there
		expect(getUnbannedUserData.user.banned_until).toBeUndefined();
	});

	it("PUT /admin/users/:userId/unban should return a 403 if a non admin user tries to access it", async () => {
		const { data, error } = await supabaseAnonClient.auth.signInWithPassword({
			email: givenUserEmail,
			password: givenUserPassword,
		});

		expect(error).toBeNull();
		expect(data.session).toBeDefined();

		const userSession = data.session;

		const response = await app.request(
			`/admin/users/${data.session.user.id}/unban`,
			{
				method: "PUT",
				headers: new Headers({
					authorization: `Bearer ${userSession.access_token}`,
				}),
			},
		);

		expect(response.status).toBe(403);
	});

	it("DELETE /admin/users/:userId should hard delete user and return 200", async () => {
		const givenUserId = userIds[givenUserEmail];

		const response = await app.request(`/admin/users/${givenUserId}`, {
			method: "DELETE",
			headers: new Headers({
				authorization: `Bearer ${adminSession?.access_token}`,
			}),
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			message: "User permanently deleted successfully",
		});

		const {
			data: { users: usersAfterDeletion },
			error: listUsersError,
		} = await serviceRoleDbClient.auth.admin.listUsers();
		const foundUser = usersAfterDeletion.find(
			(user: User) => user.id === givenUserId,
		);

		expect(listUsersError).toBeNull();
		expect(foundUser).toBeUndefined();

		const { data: profile, error: getUserError } = await serviceRoleDbClient
			.from("profiles")
			.select("*")
			.eq("id", givenUserId);

		expect(getUserError).toBeNull();
		expect(profile).toBeDefined();
		expect(profile.length).toBe(0);

		// revert the hard delete
		const { error: restoreError } =
			await serviceRoleDbClient.auth.admin.createUser({
				email: givenUserEmail,
				password: givenUserPassword,
				email_confirm: true,
			});
		expect(restoreError).toBeNull();
	});

	it("DELETE /admin/users/:userI should return a 403 if a non admin user tries to access it", async () => {
		const { data, error } = await supabaseAnonClient.auth.signInWithPassword({
			email: givenUserEmail,
			password: givenUserPassword,
		});

		expect(error).toBeNull();
		expect(data.session).toBeDefined();

		const userSession = data.session;

		const response = await app.request(`/admin/users/${data.session.user.id}`, {
			method: "DELETE",
			headers: new Headers({
				authorization: `Bearer ${userSession.access_token}`,
			}),
		});

		expect(response.status).toBe(403);
	});
});
