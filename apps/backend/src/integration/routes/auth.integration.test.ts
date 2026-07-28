import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../../index";
import { serviceRoleDbClient } from "../../supabase";

describe("/auth/register", () => {
	const givenNewEmail = "auth-register-test-suite-new@ts.berlin";
	const givenConfirmedEmail = "auth-register-test-suite-confirmed@ts.berlin";
	const givenUnconfirmedEmail =
		"auth-register-test-suite-unconfirmed@ts.berlin";
	const givenPassword = "SecurePassword123!";

	const userIds: Record<string, string> = {};

	async function deleteTestUsersIfAny(): Promise<void> {
		const { data, error } = await serviceRoleDbClient.auth.admin.listUsers();
		expect(error).toBeNull();

		for (const user of data.users) {
			if (
				![givenNewEmail, givenConfirmedEmail, givenUnconfirmedEmail].includes(
					user.email,
				)
			) {
				continue;
			}
			await serviceRoleDbClient.auth.admin.deleteUser(user.id);
		}
	}

	beforeAll(async () => {
		await deleteTestUsersIfAny();

		const { data: confirmedData, error: confirmedError } =
			await serviceRoleDbClient.auth.admin.createUser({
				email: givenConfirmedEmail,
				password: givenPassword,
				email_confirm: true,
			});
		expect(confirmedError).toBeNull();
		userIds[givenConfirmedEmail] = confirmedData.user.id;

		const { data: unconfirmedData, error: unconfirmedError } =
			await serviceRoleDbClient.auth.admin.createUser({
				email: givenUnconfirmedEmail,
				password: givenPassword,
				email_confirm: false,
			});
		expect(unconfirmedError).toBeNull();
		userIds[givenUnconfirmedEmail] = unconfirmedData.user.id;
	});

	afterAll(deleteTestUsersIfAny);

	it("creates a new user for an email that doesn't exist yet", async () => {
		const response = await app.request("/auth/register", {
			method: "POST",
			headers: new Headers({ "Content-Type": "application/json" }),
			body: JSON.stringify({
				email: givenNewEmail,
				password: givenPassword,
				firstName: "New",
				lastName: "User",
			}),
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ message: "ok" });

		const { data, error } = await serviceRoleDbClient.auth.admin.listUsers();
		expect(error).toBeNull();

		const createdUser = data.users.find((user) => user.email === givenNewEmail);
		expect(createdUser).toBeDefined();
		expect(createdUser?.email_confirmed_at).toBeUndefined();
		expect(createdUser?.user_metadata?.first_name).toBe("New");
		expect(createdUser?.user_metadata?.last_name).toBe("User");
	});

	it("sends a password reset for an existing, confirmed email", async () => {
		const response = await app.request("/auth/register", {
			method: "POST",
			headers: new Headers({ "Content-Type": "application/json" }),
			body: JSON.stringify({
				email: givenConfirmedEmail,
				password: givenPassword,
				firstName: "Whatever",
				lastName: "Whatever",
			}),
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ message: "ok" });

		const { data, error } = await serviceRoleDbClient.auth.admin.getUserById(
			userIds[givenConfirmedEmail],
		);
		expect(error).toBeNull();
		expect(data.user.recovery_sent_at).toBeTruthy();

		const { data: listData, error: listError } =
			await serviceRoleDbClient.auth.admin.listUsers();
		expect(listError).toBeNull();
		expect(
			listData.users.filter((user) => user.email === givenConfirmedEmail),
		).toHaveLength(1);
	});

	it("resends the signup confirmation for an existing, unconfirmed email", async () => {
		const response = await app.request("/auth/register", {
			method: "POST",
			headers: new Headers({ "Content-Type": "application/json" }),
			body: JSON.stringify({
				email: givenUnconfirmedEmail,
				password: givenPassword,
				firstName: "Whatever",
				lastName: "Whatever",
			}),
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ message: "ok" });

		const { data, error } = await serviceRoleDbClient.auth.admin.getUserById(
			userIds[givenUnconfirmedEmail],
		);
		expect(error).toBeNull();
		expect(data.user.confirmation_sent_at).toBeTruthy();

		const { data: listData, error: listError } =
			await serviceRoleDbClient.auth.admin.listUsers();
		expect(listError).toBeNull();
		expect(
			listData.users.filter((user) => user.email === givenUnconfirmedEmail),
		).toHaveLength(1);
	});

	it("returns 400 when email is missing", async () => {
		const response = await app.request("/auth/register", {
			method: "POST",
			headers: new Headers({ "Content-Type": "application/json" }),
			body: JSON.stringify({
				password: givenPassword,
				firstName: "New",
				lastName: "User",
			}),
		});

		expect(response.status).toBe(400);
	});

	it("does not return 400 when only email is provided", async () => {
		const response = await app.request("/auth/register", {
			method: "POST",
			headers: new Headers({ "Content-Type": "application/json" }),
			body: JSON.stringify({
				email: givenConfirmedEmail,
			}),
		});

		expect(response.status).toBe(200);
	});

	it("sends a password reset for an existing, confirmed email when only email is provided", async () => {
		const response = await app.request("/auth/register", {
			method: "POST",
			headers: new Headers({ "Content-Type": "application/json" }),
			body: JSON.stringify({
				email: givenConfirmedEmail,
			}),
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ message: "ok" });

		const { data, error } = await serviceRoleDbClient.auth.admin.getUserById(
			userIds[givenConfirmedEmail],
		);
		expect(error).toBeNull();
		expect(data.user.recovery_sent_at).toBeTruthy();

		const { data: listData, error: listError } =
			await serviceRoleDbClient.auth.admin.listUsers();
		expect(listError).toBeNull();
		expect(
			listData.users.filter((user) => user.email === givenConfirmedEmail),
		).toHaveLength(1);
	});

	it("resends the signup confirmation for an existing, unconfirmed email when only email is provided", async () => {
		const response = await app.request("/auth/register", {
			method: "POST",
			headers: new Headers({ "Content-Type": "application/json" }),
			body: JSON.stringify({
				email: givenUnconfirmedEmail,
			}),
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ message: "ok" });

		const { data, error } = await serviceRoleDbClient.auth.admin.getUserById(
			userIds[givenUnconfirmedEmail],
		);
		expect(error).toBeNull();
		expect(data.user.confirmation_sent_at).toBeTruthy();

		const { data: listData, error: listError } =
			await serviceRoleDbClient.auth.admin.listUsers();
		expect(listError).toBeNull();
		expect(
			listData.users.filter((user) => user.email === givenUnconfirmedEmail),
		).toHaveLength(1);
	});
});
