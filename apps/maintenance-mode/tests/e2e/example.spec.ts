import { test, expect } from "@playwright/test";

test("has title", async ({ page }) => {
	await page.goto("/");

	// Expect a page title "to contain" a substring.
	await expect(page).toHaveTitle("Template");
});

test("has h1", async ({ page }) => {
	await page.goto("/");

	// Expect an element "to be visible".
	await expect(page.getByRole("heading", { name: "Template" })).toBeVisible();
});
