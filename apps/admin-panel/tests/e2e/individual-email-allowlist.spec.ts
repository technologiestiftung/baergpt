import { expect, type Page } from "@playwright/test";
import { testWithLoggedInAdminUser as test } from "../fixtures/test-with-logged-in-admin-user.ts";
import { supabaseAdminClient } from "../supabase.ts";

test.describe("Individual Email Allowlist", () => {
	test("shows validation error for malformed email", async ({ page }) => {
		await gotoIndividualEmailAllowlist(page);

		await page.locator("#email").fill("not-an-email");
		await page.getByRole("button", { name: "E-Mail hinzufügen" }).click();

		await expect(
			page.getByRole("button", { name: "E-Mail hinzugefügt" }),
		).not.toBeVisible();
	});

	test("removing an email that has an account also deletes the account", async ({
		page,
		testEmail,
	}) => {
		await gotoIndividualEmailAllowlist(page);

		// Insert allowlist entry
		await insertTestEmail(testEmail);

		// Create a real user account for that email
		const id = crypto.randomUUID();

		const { data: createdUser, error: createError } =
			await supabaseAdminClient.auth.admin.createUser({
				id,
				email: testEmail,
				email_confirm: true,
			});
		expect(createError).toBeNull();
		expect(createdUser.user).toBeDefined();

		await page.reload();

		await searchEmail(page, testEmail);
		const row = emailRow(page, testEmail);
		await expect(row).toBeVisible();

		// Remove
		await row.getByRole("button", { name: "Entfernen" }).click();
		await expect(
			page.getByRole("dialog", { name: "E-Mail entfernen" }),
		).toBeVisible();
		await confirmRemove(page);

		// Email no longer in allowlist
		await searchEmail(page, testEmail);
		await expect(emailRow(page, testEmail)).not.toBeVisible();

		// User account should be deleted
		const { data: deletedUser } =
			await supabaseAdminClient.auth.admin.getUserById(id);
		expect(deletedUser.user).toBeNull();
	});

	test("canceling remove dialog leaves email in the list", async ({
		page,
		testEmail,
	}) => {
		await gotoIndividualEmailAllowlist(page);

		await insertTestEmail(testEmail);
		await page.reload();
		await expect(
			page.getByRole("heading", { name: "E-Mail-Verwaltung" }),
		).toBeVisible();

		await searchEmail(page, testEmail);
		const row = emailRow(page, testEmail);
		await expect(row).toBeVisible();

		await row.getByRole("button", { name: "Entfernen" }).click();
		await expect(
			page.getByRole("dialog", { name: "E-Mail entfernen" }),
		).toBeVisible();
		await cancelRemove(page);

		await searchEmail(page, testEmail);
		await expect(emailRow(page, testEmail)).toBeVisible();
	});

	test("shows 'Ja' in Account column when user exists for the email", async ({
		page,
		adminAccount,
	}) => {
		await gotoIndividualEmailAllowlist(page);

		await insertTestEmail(adminAccount.email);

		await page.reload();
		await expect(
			page.getByRole("heading", { name: "E-Mail-Verwaltung" }),
		).toBeVisible();

		await searchEmail(page, adminAccount.email);
		const row = emailRow(page, adminAccount.email);
		await expect(row).toBeVisible();
		await expect(row.getByText("Ja", { exact: true })).toBeVisible();
	});

	test("shows 'Nein' in Account column for email without an account", async ({
		page,
		testEmail,
	}) => {
		await gotoIndividualEmailAllowlist(page);

		await insertTestEmail(testEmail);

		await page.reload();
		await expect(
			page.getByRole("heading", { name: "E-Mail-Verwaltung" }),
		).toBeVisible();

		await searchEmail(page, testEmail);
		const row = emailRow(page, testEmail);
		await expect(row).toBeVisible();
		await expect(row.getByText("Nein", { exact: true })).toBeVisible();
	});

	test("shows error when adding an email that already exists in the allowlist", async ({
		page,
		testEmail,
	}) => {
		await gotoIndividualEmailAllowlist(page);

		await insertTestEmail(testEmail);

		await page.locator("#email").fill(testEmail);
		await page.getByRole("button", { name: "E-Mail hinzufügen" }).click();

		const errorMessage = page.getByText(
			"Diese E-Mail-Adresse ist bereits in der Allowlist.",
		);
		await expect(errorMessage).toBeVisible();
		await expect(
			page.getByRole("button", { name: "E-Mail hinzugefügt" }),
		).not.toBeVisible();
	});
});

async function gotoIndividualEmailAllowlist(page: Page) {
	await page.goto("/individual-email-allowlist/");
	await expect(
		page.getByRole("heading", { name: "E-Mail-Verwaltung" }),
	).toBeVisible();
}

async function searchEmail(page: Page, email: string) {
	await page.getByPlaceholder("Suche nach E-Mail...").fill(email);
}

function emailRow(page: Page, email: string) {
	return page.getByRole("row").filter({ hasText: email });
}

async function confirmRemove(page: Page) {
	const dialog = page.getByRole("dialog");
	await expect(dialog).toBeVisible();
	await dialog.getByRole("button", { name: "Entfernen" }).click();
	await expect(dialog).not.toBeVisible();
}

async function cancelRemove(page: Page) {
	const dialog = page.getByRole("dialog");
	await expect(dialog).toBeVisible();
	await dialog.getByRole("button", { name: "Abbrechen" }).click();
	await expect(dialog).not.toBeVisible();
}

async function insertTestEmail(email: string) {
	const { error } = await supabaseAdminClient
		.from("allowed_individual_emails")
		.insert({ email });
	expect(error).toBeNull();
}
