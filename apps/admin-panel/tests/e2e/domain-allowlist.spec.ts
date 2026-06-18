import { expect, type Locator, type Page } from "@playwright/test";
import { testWithAdminUser as test } from "../fixtures/test-with-admin-user.ts";
import { supabaseAdminClient } from "../supabase.ts";

const WILDCARD_DOMAIN_ERROR =
	"Wildcard-Muster wie *.berlin.de sind nicht erlaubt. Bitte geben Sie eine konkrete Domain ein.";
const INVALID_FORMAT_ERROR =
	"Bitte geben Sie eine gültige Domain ein (z. B. senjustv.berlin.de).";

type AdminAccount = {
	email: string;
	password: string;
	id: string;
};

async function loginAsAdmin(page: Page, account: AdminAccount) {
	await page.goto("/login/");
	await page
		.getByRole("textbox", { name: "E-Mail-Adresse" })
		.fill(account.email);
	await page.getByRole("textbox", { name: "Passwort" }).fill(account.password);
	await page.getByRole("button", { name: "Anmelden" }).click();
	await expect(page).toHaveURL("/");
}

async function gotoDomainAllowlist(page: Page) {
	await page.goto("/domain-allowlist/");
	await expect(
		page.getByRole("heading", { name: "Domainverwaltung" }),
	).toBeVisible();
}

async function searchDomain(page: Page, domain: string) {
	await page.getByPlaceholder("Suche nach Domain...").fill(domain);
}

function domainRow(page: Page, domain: string) {
	return page.getByRole("row").filter({ hasText: domain });
}

async function expectDomainStatus(row: Locator, status: "aktiv" | "inaktiv") {
	await expect(row.getByText(status, { exact: true })).toBeVisible();
}

async function confirmStatusChange(
	page: Page,
	action: "Deaktivieren" | "Aktivieren",
) {
	const dialog = page.getByRole("dialog");
	await expect(dialog).toBeVisible();
	await dialog.getByRole("button", { name: action }).click();
	await expect(dialog).not.toBeVisible();
}

async function cancelStatusChange(page: Page) {
	const dialog = page.getByRole("dialog");
	await expect(dialog).toBeVisible();
	await dialog.getByRole("button", { name: "Abbrechen" }).click();
	await expect(dialog).not.toBeVisible();
}

async function deleteTestDomain(domain: string) {
	const { error } = await supabaseAdminClient
		.from("allowed_email_domains")
		.delete()
		.eq("domain", domain);
	expect(error).toBeNull();
}

async function insertActiveTestDomain(domain: string) {
	const { error } = await supabaseAdminClient
		.from("allowed_email_domains")
		.insert({ domain, is_active: true });
	expect(error).toBeNull();
}

test.describe("Domain Allowlist", () => {
	test.beforeEach(async ({ page, adminAccount }) => {
		await loginAsAdmin(page, adminAccount);
		await gotoDomainAllowlist(page);
	});

	test("shows validation error for wildcard domain", async ({ page }) => {
		await page.locator("#domain").fill("*.berlin.de");
		await page.getByRole("button", { name: "Domain hinzufügen" }).click();

		await expect(page.locator("#domain-error")).toBeVisible();
		await expect(page.getByText(WILDCARD_DOMAIN_ERROR)).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Domain hinzugefügt" }),
		).not.toBeVisible();
	});

	test("shows validation error for malformed domain", async ({ page }) => {
		await page.locator("#domain").fill("not-a-valid-domain");
		await page.getByRole("button", { name: "Domain hinzufügen" }).click();

		await expect(page.locator("#domain-error")).toBeVisible();
		await expect(page.getByText(INVALID_FORMAT_ERROR)).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Domain hinzugefügt" }),
		).not.toBeVisible();
	});

	test("adds, deactivates, and reactivates a domain", async ({
		page,
	}, testInfo) => {
		const testDomain = `e2e-${testInfo.project.name}-${testInfo.workerIndex}.berlin.de`;

		try {
			await page.locator("#domain").fill(testDomain);
			await page.getByRole("button", { name: "Domain hinzufügen" }).click();
			await expect(
				page.getByRole("button", { name: "Domain hinzugefügt" }),
			).toBeVisible();

			await searchDomain(page, testDomain);
			const row = domainRow(page, testDomain);
			await expect(row).toBeVisible();
			await expectDomainStatus(row, "aktiv");
			await expect(
				row.getByRole("button", { name: "Deaktivieren" }),
			).toBeVisible();

			await row.getByRole("button", { name: "Deaktivieren" }).click();
			await expect(
				page.getByRole("dialog", { name: "Domain deaktivieren" }),
			).toBeVisible();
			await confirmStatusChange(page, "Deaktivieren");

			await searchDomain(page, testDomain);
			const deactivatedRow = domainRow(page, testDomain);
			await expectDomainStatus(deactivatedRow, "inaktiv");
			await expect(
				deactivatedRow.getByRole("button", { name: "Aktivieren" }),
			).toBeVisible();

			await deactivatedRow.getByRole("button", { name: "Aktivieren" }).click();
			await expect(
				page.getByRole("dialog", { name: "Domain aktivieren" }),
			).toBeVisible();
			await confirmStatusChange(page, "Aktivieren");

			await searchDomain(page, testDomain);
			const reactivatedRow = domainRow(page, testDomain);
			await expectDomainStatus(reactivatedRow, "aktiv");
			await expect(
				reactivatedRow.getByRole("button", { name: "Deaktivieren" }),
			).toBeVisible();
		} finally {
			await deleteTestDomain(testDomain);
		}
	});

	test("canceling status change dialog leaves domain active", async ({
		page,
	}, testInfo) => {
		const testDomain = `e2e-cancel-${testInfo.project.name}-${testInfo.workerIndex}.berlin.de`;

		try {
			await insertActiveTestDomain(testDomain);
			await page.reload();
			await expect(
				page.getByRole("heading", { name: "Domainverwaltung" }),
			).toBeVisible();

			await searchDomain(page, testDomain);
			const row = domainRow(page, testDomain);
			await expect(row).toBeVisible();
			await expectDomainStatus(row, "aktiv");

			await row.getByRole("button", { name: "Deaktivieren" }).click();
			await expect(
				page.getByRole("dialog", { name: "Domain deaktivieren" }),
			).toBeVisible();
			await cancelStatusChange(page);

			await searchDomain(page, testDomain);
			const unchangedRow = domainRow(page, testDomain);
			await expectDomainStatus(unchangedRow, "aktiv");
			await expect(
				unchangedRow.getByRole("button", { name: "Deaktivieren" }),
			).toBeVisible();
		} finally {
			await deleteTestDomain(testDomain);
		}
	});
});
