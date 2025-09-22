import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_TEST_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
	throw new Error("Missing required environment variables for Supabase client");
}

const supabaseAdminClient = createClient(supabaseUrl, supabaseServiceKey);

test.describe("Auth Admin", () => {
	let testEmail: string;
	let userId: string | undefined;

	test.beforeAll(async ({}, testInfo) => {
		testEmail = `admin+${testInfo.workerIndex}@berlin.de`;
		const { data, error } = await supabaseAdminClient.auth.admin.createUser({
			email: testEmail,
			password: "password123",
			email_confirm: true,
		});

		if (error) {
			throw new Error(`Failed to create admin user: ${error.message}`);
		}
		userId = data.user?.id;

		expect(userId).toBeDefined();

		const { error: adminError } = await supabaseAdminClient
			.from("application_admins")
			.insert([{ user_id: userId }]);

		expect(adminError).toBeNull();
	});

	test.afterAll(async () => {
		if (!testEmail) return;
		const { data, error } = await supabaseAdminClient.auth.admin.listUsers();
		if (error) {
			console.error("Error listing users:", error);
			return;
		}
		const user = data.users.find(({ email }) => email === testEmail);
		if (!user) {
			return;
		}
		const { error: deleteError } =
			await supabaseAdminClient.auth.admin.deleteUser(user.id);
		if (deleteError) {
			console.error("Error deleting user:", deleteError);
		}
	});

	test("Admin Login", async ({ page }) => {
		await page.goto("/login/");
		await page.getByRole("textbox", { name: "E-Mail-Adresse" }).fill(testEmail);
		await page.getByRole("textbox", { name: "Passwort" }).fill("password123");
		await page.getByRole("button", { name: "Anmelden" }).click();
		await expect(page).toHaveURL("/");
		await expect(
			page.getByRole("heading", { name: "Benutzerverwaltung" }),
		).toBeVisible();
		await expect(page.getByRole("table")).toBeVisible();
		await expect(page.getByRole("table").getByText("Vorname")).toBeVisible();
	});
});
