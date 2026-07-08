import { expect } from "@playwright/test";
import { testWithAdminUser as test } from "../fixtures/test-with-admin-user.ts";

test("Admin Login", async ({ page, adminAccount }) => {
	await page.goto("/login/");
	await page
		.getByRole("textbox", { name: "E-Mail-Adresse" })
		.fill(adminAccount.email);
	await page
		.getByRole("textbox", { name: "Passwort" })
		.fill(adminAccount.password);
	await page.getByRole("button", { name: "Anmelden" }).click();
	await expect(page).toHaveURL("/");
	await expect(
		page.getByRole("heading", { name: "Benutzerverwaltung" }),
	).toBeVisible();
	await expect(page.getByRole("table")).toBeVisible();
	await expect(page.getByRole("table").getByText("Vorname")).toBeVisible();
});
