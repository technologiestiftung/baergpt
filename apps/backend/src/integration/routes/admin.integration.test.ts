import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "vitest";
import { createClient, type Session } from "@supabase/supabase-js";
import type { Database } from "@repo/db-schema";
import app from "../../index";
import { config } from "../../config";
import { supabase as supabaseAdminClient } from "../../supabase";
import { addDays } from "date-fns";

const supabaseAnonClient = createClient<Database>(
	config.supabaseUrl,
	config.supabaseAnonKey,
);

describe("/admin/", () => {
	const givenAdminEmail = "admin-test-suite-admin@berlin.de";
	const givenAdminPassword = "SecurePassword123!";

	const givenUserEmail = "admin-test-suite-user@berlin.de";
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
				await supabaseAdminClient.auth.admin.createUser({
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
		} = await supabaseAdminClient.auth.admin.listUsers();
		expect(listUsersError).toBeNull();

		const adminUser = adminUsers.find(({ email }) => email === givenAdminEmail);

		const { error: setAdminError } = await supabaseAdminClient
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
		const { data, error } = await supabaseAdminClient.auth.admin.listUsers({});

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
				await supabaseAdminClient.auth.admin.deleteUser(user.id);
			expect(deleteError).toBeNull();
		}
	});

	it("PUT /admin/users/:userId/profile should update user profile and return 200", async () => {
		const givenUpdatedUser = {
			email: "updated@email.com",
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
		} = await supabaseAdminClient.auth.admin.listUsers();
		expect(listUsersError).toBeNull();

		const { data: profile, error: getUserError } = await supabaseAdminClient
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

		const { count } = await supabaseAdminClient
			.from("application_admins")
			.select("*", { count: "exact", head: true })
			.eq("user_id", givenUserId);

		const expected = count === 1;

		expect(expected).toBe(true);

		// revert the changes
		const { error } = await supabaseAdminClient
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

	it("DELETE /admin/users/:userId should soft delete user and return 200", async () => {
		const givenUserId = userIds[givenUserEmail];

		const response = await app.request(`/admin/users/${givenUserId}`, {
			method: "DELETE",
			headers: new Headers({
				authorization: `Bearer ${adminSession?.access_token}`,
			}),
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			message: "User soft deleted successfully",
		});

		const { data: profile, error: getUserError } = await supabaseAdminClient
			.from("user_active_status")
			.select("*")
			.eq("id", givenUserId)
			.single();
		expect(getUserError).toBeNull();

		expect(profile).toBeDefined();
		expect(profile.is_active).toBe(false);
		expect(profile.deleted_at).toBeDefined();

		// revert the soft delete
		const { error } = await supabaseAdminClient
			.from("user_active_status")
			.update({
				is_active: true,
				deleted_at: null,
			})
			.eq("id", givenUserId);
		expect(error).toBeNull();
	});

	it("DELETE /admin/users/:userId should return a 403 if a non admin user tries to access it", async () => {
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

	it("PUT /admin/users/:userId/restore should restore user and return 200", async () => {
		const givenUserId = userIds[givenUserEmail];

		// soft delete a given user first
		const { error } = await supabaseAdminClient
			.from("user_active_status")
			.update({
				is_active: false,
				deleted_at: addDays(new Date(), 1).toISOString(),
			})
			.eq("id", givenUserId);
		expect(error).toBeNull();

		const response = await app.request(`/admin/users/${givenUserId}/restore`, {
			method: "PUT",
			headers: new Headers({
				authorization: `Bearer ${adminSession?.access_token}`,
			}),
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			message: "User restored successfully",
		});

		const { data: profile, error: getUserError } = await supabaseAdminClient
			.from("user_active_status")
			.select("*")
			.eq("id", givenUserId)
			.single();
		expect(getUserError).toBeNull();

		expect(profile).toBeDefined();
		expect(profile.is_active).toBe(true);
		expect(profile.deleted_at).toBeNull();
	});

	it("PUT /admin/users/:userId/restore should return a 403 if a non admin user tries to access it", async () => {
		const { data, error } = await supabaseAnonClient.auth.signInWithPassword({
			email: givenUserEmail,
			password: givenUserPassword,
		});

		expect(error).toBeNull();
		expect(data.session).toBeDefined();

		const userSession = data.session;

		const response = await app.request(
			`/admin/users/${data.session.user.id}/restore`,
			{
				method: "PUT",
				headers: new Headers({
					authorization: `Bearer ${userSession.access_token}`,
				}),
			},
		);

		expect(response.status).toBe(403);
	});

	it("DELETE /admin/users/:userId?hard=true should hard delete user and return 200", async () => {
		const givenUserId = userIds[givenUserEmail];

		const response = await app.request(
			`/admin/users/${givenUserId}?hard=true`,
			{
				method: "DELETE",
				headers: new Headers({
					authorization: `Bearer ${adminSession?.access_token}`,
				}),
			},
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			message: "User permanently deleted successfully",
		});

		const {
			data: { users: usersAfterDeletion },
			error: listUsersError,
		} = await supabaseAdminClient.auth.admin.listUsers();
		const foundUser = usersAfterDeletion.find(
			(user) => user.id === givenUserId,
		);

		expect(listUsersError).toBeNull();
		expect(foundUser).toBeUndefined();

		const { data: profile, error: getUserError } = await supabaseAdminClient
			.from("profiles")
			.select("*")
			.eq("id", givenUserId);

		expect(getUserError).toBeNull();
		expect(profile).toBeDefined();
		expect(profile.length).toBe(0);

		// revert the hard delete
		const { error: restoreError } =
			await supabaseAdminClient.auth.admin.createUser({
				email: givenUserEmail,
				password: givenUserPassword,
				email_confirm: true,
			});
		expect(restoreError).toBeNull();
	});

	it("DELETE /admin/users/:userId?=hard should return a 403 if a non admin user tries to access it", async () => {
		const { data, error } = await supabaseAnonClient.auth.signInWithPassword({
			email: givenUserEmail,
			password: givenUserPassword,
		});

		expect(error).toBeNull();
		expect(data.session).toBeDefined();

		const userSession = data.session;

		const response = await app.request(
			`/admin/users/${data.session.user.id}?hard=true`,
			{
				method: "DELETE",
				headers: new Headers({
					authorization: `Bearer ${userSession.access_token}`,
				}),
			},
		);

		expect(response.status).toBe(403);
	});

	it("POST /admin/users/invite should invite a new user and return 200", async () => {
		const givenEmail = "db-test-suite-new-user@berlin.de";
		const givenFirstName = "Jane";
		const givenLastName = "Doe";

		const response = await app.request(`/admin/users/invite`, {
			method: "POST",
			headers: new Headers({
				authorization: `Bearer ${adminSession?.access_token}`,
			}),
			body: JSON.stringify({
				email: givenEmail,
				firstName: givenFirstName,
				lastName: givenLastName,
			}),
		});

		const json = await response.json();

		expect(response.status).toBe(200);
		expect(json).toStrictEqual({
			message: "Invite link sent successfully",
		});

		// Check if the user has been added to the users table
		const {
			data: { users: userList },
			error: listUsersError,
		} = await supabaseAdminClient.auth.admin.listUsers();
		expect(listUsersError).toBeNull();

		const invitedUser = userList.find((user) => user.email === givenEmail);

		expect(invitedUser).toBeDefined();
		expect(invitedUser).not.toBeNull();

		// Check if the user has been added to the profiles table with the correct first and last name
		const { data: profile, error: getUserError } = await supabaseAdminClient
			.from("profiles")
			.select("*")
			.eq("id", invitedUser.id)
			.single();
		expect(getUserError).toBeNull();
		expect(profile).toBeDefined();

		const actualFirstName = profile.first_name;
		const actualLastName = profile.last_name;

		expect(actualFirstName).toStrictEqual(givenFirstName);
		expect(actualLastName).toStrictEqual(givenLastName);

		// Clean up: delete the invited user
		const { error: deleteError } =
			await supabaseAdminClient.auth.admin.deleteUser(invitedUser.id);
		expect(deleteError).toBeNull();
	});

	it("POST /admin/users/invite should resend an invite to an existing user and return 200", async () => {
		const givenEmail = "db-test-suite-new-user@berlin.de";
		const givenFirstName = "Jane";
		const givenLastName = "Doe";

		const { data, error } =
			await supabaseAdminClient.auth.admin.inviteUserByEmail(givenEmail, {
				data: {
					first_name: givenFirstName,
					last_name: givenLastName,
				},
			});
		expect(error).toBeNull();
		expect(data).toBeDefined();

		const invitedUser = data.user;

		const response = await app.request(`/admin/users/invite`, {
			method: "POST",
			headers: new Headers({
				authorization: `Bearer ${adminSession?.access_token}`,
			}),
			body: JSON.stringify({
				email: givenEmail,
			}),
		});

		const json = await response.json();

		expect(response.status).toBe(200);
		expect(json).toStrictEqual({
			message: "Invite link sent successfully",
		});

		// Clean up: delete the invited user
		const { error: deleteError } =
			await supabaseAdminClient.auth.admin.deleteUser(invitedUser.id);
		expect(deleteError).toBeNull();
	});

	it("POST /admin/users/invite should return a 403 if a non admin user tries to access it", async () => {
		const { data, error } = await supabaseAnonClient.auth.signInWithPassword({
			email: givenUserEmail,
			password: givenUserPassword,
		});

		expect(error).toBeNull();
		expect(data.session).toBeDefined();

		const userSession = data.session;

		const response = await app.request(`/admin/users/invite`, {
			method: "POST",
			headers: new Headers({
				authorization: `Bearer ${userSession.access_token}`,
			}),
		});

		expect(response.status).toBe(403);
	});
});
