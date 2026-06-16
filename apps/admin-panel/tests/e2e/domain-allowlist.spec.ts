import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_TEST_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
	throw new Error("Missing required environment variables for Supabase client");
}

const supabaseAdminClient = createClient(supabaseUrl, supabaseServiceKey);

const WILDCARD_DOMAIN_ERROR =
	"Wildcard-Muster wie *.berlin.de sind nicht erlaubt. Bitte geben Sie eine konkrete Domain ein.";
const INVALID_FORMAT_ERROR =
	"Bitte geben Sie eine gültige Domain ein (z. B. senjustv.berlin.de).";

async function loginAsAdmin(page: Page, email: string, password: string) {
	await page.goto("/login/");
	await page.getByRole("textbox", { name: "E-Mail-Adresse" }).fill(email);
	await page.getByRole("textbox", { name: "Passwort" }).fill(password);
	await page.getByRole("button", { name: "Anmelden" }).click();
	await expect(page).toHaveURL("/");
}

async function gotoDomainAllowlist(page: Page) {
	await page.goto("/domain-allowlist/");
	await expect(
		page.getByRole("heading", { name: "Domainverwaltung" }),
	).toBeVisible();
}

async function fillAddDomainForm(
	page: Page,
	domain: string,
	description: string,
) {
	await page.locator("#domain").fill(domain);
	await page.locator("#description").fill(description);
}

test.describe("Domain Allowlist", () => {
	let testEmail: string;
	let userId: string | undefined;

	test.beforeAll(async ({}, testInfo) => {
		testEmail = `domain-admin+${testInfo.workerIndex}@local.berlin.de`;
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
		if (!testEmail) {
			return;
		}

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

	test.beforeEach(async ({ page }) => {
		await loginAsAdmin(page, testEmail, "password123");
		await gotoDomainAllowlist(page);
	});

	test("shows validation error for wildcard domain", async ({ page }) => {
		await fillAddDomainForm(page, "*.berlin.de", "Wildcard test");

		await page.getByRole("button", { name: "Domain hinzufügen" }).click();

		await expect(page.locator("#domain-error")).toBeVisible();
		await expect(page.getByText(WILDCARD_DOMAIN_ERROR)).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Domain hinzugefügt" }),
		).not.toBeVisible();
	});

	test("shows validation error for malformed domain", async ({ page }) => {
		await fillAddDomainForm(page, "not-a-valid-domain", "Malformed test");

		await page.getByRole("button", { name: "Domain hinzufügen" }).click();

		await expect(page.locator("#domain-error")).toBeVisible();
		await expect(page.getByText(INVALID_FORMAT_ERROR)).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Domain hinzugefügt" }),
		).not.toBeVisible();
	});
});
