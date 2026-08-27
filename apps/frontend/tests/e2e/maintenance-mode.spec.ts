import { createClient } from "@supabase/supabase-js";
import type { Database } from "@repo/db-schema";
import { expect, test } from "@playwright/test";
import { testWithLoggedInUser } from "../fixtures/test-with-logged-in-user.ts";
import { supabaseAdminClient, supabaseAnonClient } from "../supabase.ts";
import { config } from "../config.ts";
import { defaultUserFirstName, defaultUserLastName } from "../constants.ts";

// Tagged @no-parallel: these tests flip the app-global `maintenance_mode` row,
// which logs out every user app-wide. The CI/npm scripts run this describe on
// its own (workers:1), separately from the parallel suite, so it never overlaps
// other tests. See playwright.config / package.json test:e2e:no-parallel.
test.describe("Maintenance Mode", { tag: "@no-parallel" }, () => {
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

			// Step 3: Reload the page to trigger maintenance mode check
			await page.reload();

			// Step 4: Verify user is redirected to landing page (logged out)
			await expect(
				page.getByRole("heading", {
					name: "BärGPT, der KI-Assistent für die Berliner Verwaltung",
				}),
			).toBeVisible();
		},
	);

	test("anonymous client cannot update maintenance_mode", async () => {
		const { error } = await supabaseAnonClient
			.from("maintenance_mode")
			.upsert(
				{ onerow_id: true, is_enabled: true },
				{ onConflict: "onerow_id" },
			);

		expect(error).not.toBeNull();
	});

	testWithLoggedInUser(
		"authenticated user cannot update maintenance_mode",
		async ({ session }) => {
			// Build a client carrying the logged-in (non-admin) user's JWT. The
			// shared `supabaseAnonClient` is no longer authenticated by the login
			// fixture (sign-in uses a per-test client), so we must attach the
			// session explicitly to actually exercise the authenticated path.
			const authedClient = createClient<Database>(
				config.supabaseUrl,
				config.supabaseAnonKey,
				{
					global: {
						headers: { Authorization: `Bearer ${session.access_token}` },
					},
					auth: { persistSession: false },
				},
			);

			const { error } = await authedClient
				.from("maintenance_mode")
				.upsert(
					{ onerow_id: true, is_enabled: true },
					{ onConflict: "onerow_id" },
				);

			expect(error).not.toBeNull();
		},
	);
});
