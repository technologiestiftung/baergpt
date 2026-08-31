import { expect } from "@playwright/test";
import { testWithAdminUser as test } from "../fixtures/test-with-admin-user.ts";
import { enterLoginOtp } from "../fixtures/confirm-otp.ts";

test("Admin Login", async ({ page, adminAccount }) => {
	await page.goto("/login/");
	await page
		.getByRole("textbox", { name: "E-Mail-Adresse" })
		.fill(adminAccount.email);
	await page.getByRole("button", { name: "Code anfordern" }).click();

	// Passwordless login navigates to the confirm-code page; enter the emailed code.
	await expect(
		page.getByRole("heading", { name: "Anmeldung bestätigen" }),
	).toBeVisible();
	await enterLoginOtp(page, adminAccount.email);

	await expect(page).toHaveURL("/");
	await expect(
		page.getByRole("heading", { name: "Benutzerverwaltung" }),
	).toBeVisible();
	await expect(page.getByRole("table")).toBeVisible();
	await expect(page.getByRole("table").getByText("Vorname")).toBeVisible();
});
