import { expect, test } from "@playwright/test";
import { testWithLoggedInUser } from "../fixtures/test-with-logged-in-user.ts";
import { supabaseAdminClient } from "../supabase.ts";
import { defaultUserFirstName, defaultUserLastName } from "../constants.ts";

test.describe("Maintenance Mode", () => {
	test.beforeEach(async () => {
		// Ensure maintenance mode is disabled before each test
		// Use upsert since we can't delete from the table
		const { error } = await supabaseAdminClient
			.from("maintenance_mode")
			.upsert(
				{ onerow_id: true, is_enabled: false },
				{ onConflict: "onerow_id" },
			);

		if (error) {
			console.error("Failed to set maintenance mode to disabled:", error);
		}
	});

	test.afterEach(async () => {
		// Clean up: ensure maintenance mode is disabled after each test
		// Use upsert since we can't delete from the table
		const { error } = await supabaseAdminClient
			.from("maintenance_mode")
			.upsert(
				{ onerow_id: true, is_enabled: false },
				{ onConflict: "onerow_id" },
			);

		if (error) {
			console.error("Failed to set maintenance mode to disabled:", error);
		}
	});

	testWithLoggedInUser(
		"User should be automatically logged out when maintenance mode is enabled",
		async ({ page }) => {
			// Step 1: Go to the app (user is already logged in via fixture)
			await page.goto("/");

			// Verify user is logged in
			await expect(
				page.getByRole("heading", {
					name: `Willkommen bei BärGPT, ${defaultUserFirstName} ${defaultUserLastName}`,
				}),
			).toBeVisible();

			// Step 2: Enable maintenance mode in the database
			const { error: insertError } = await supabaseAdminClient
				.from("maintenance_mode")
				.upsert(
					{ onerow_id: true, is_enabled: true },
					{ onConflict: "onerow_id" },
				);

			expect(insertError).toBeNull();

			// Step 3: Refresh the page to trigger maintenance mode check
			await page.reload();

			// Wait a moment for the page to process maintenance mode
			await page.waitForTimeout(1000);

			// Step 4: Verify user is redirected to landing page (logged out)
			await expect(
				page.getByRole("heading", {
					name: /B.*rGPT, der KI-Assistent f.*r die Berliner Verwaltung/,
				}),
			).toBeVisible();
		},
	);
});
