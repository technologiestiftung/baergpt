import { test, expect } from "@playwright/test";

test.describe("Maintenance Mode Page", () => {
	test("Displays maintenance mode message", async ({ page }) => {
		await page.goto("/");

		// Check for maintenance mode heading
		const heading = page.getByRole("heading", {
			name: "BärGPT ist vorübergehend nicht erreichbar.",
		});
		await expect(heading).toBeVisible();
	});
});