import { expect, type Page } from "@playwright/test";
import { testWithUser } from "../fixtures/test-with-normal-users.ts";
import { supabaseAdminClient } from "../supabase.ts";

testWithUser.describe("User Management", () => {
	testWithUser.describe("Ban / Unban user", () => {
		testWithUser(
			"admin can ban a user and the user appears as banned",
			async ({ page, testUser }) => {
				await gotoUserManagement(page);

				await searchUser(page, testUser.email);

				// Verify the user is currently active
				const row = userRow(page, testUser.email);
				await expect(row).toBeVisible();
				await expect(row.getByText("active")).toBeVisible();

				// Open the ban/delete dialog and choose "ban" (default selection)
				const banDialog = await openBanOrDeleteDialog(page, testUser.email);
				const banRadio = banDialog.locator("#ban");
				await expect(banRadio).toBeChecked(); // default

				// Confirm
				await banDialog
					.getByRole("button", { name: "Benutzer deaktivieren" })
					.click();

				// Dialog and edit modal should close
				await expect(
					page.getByRole("dialog", { name: "Account verwalten" }),
				).not.toBeVisible();
				await expect(
					page.getByRole("dialog", { name: "Benutzer bearbeiten" }),
				).not.toBeVisible();

				// User row should now show "banned"
				await searchUser(page, testUser.email);
				await expect(
					userRow(page, testUser.email).getByText("banned"),
				).toBeVisible();
			},
		);

		testWithUser(
			"admin can cancel the ban dialog without changing the user",
			async ({ page, testUser }) => {
				await gotoUserManagement(page);

				await searchUser(page, testUser.email);

				const banDialog = await openBanOrDeleteDialog(page, testUser.email);
				await banDialog.getByRole("button", { name: "Abbrechen" }).click();

				// Dialogs should close
				await expect(
					page.getByRole("dialog", { name: "Account verwalten" }),
				).not.toBeVisible();

				const closeUserEditDialogButton = page.getByRole("button", {
					name: "Close",
				});
				await closeUserEditDialogButton.click();

				// User should still be active
				await searchUser(page, testUser.email);
				await expect(
					userRow(page, testUser.email).getByText("active"),
				).toBeVisible();
			},
		);

		testWithUser(
			"admin can unban (restore) a previously banned user",
			async ({ page, testUser }) => {
				// Ban the user first via Supabase directly to keep the test focused
				await banUser(testUser.id);

				await gotoUserManagement(page);

				// User should be banned
				await searchUser(page, testUser.email);
				await expect(
					userRow(page, testUser.email).getByText("banned"),
				).toBeVisible();

				// Open edit modal – "Account wiederherstellen" button only appears for banned users
				const editDialog = await openEditModal(page, testUser.email);
				await editDialog
					.getByRole("button", { name: "Account wiederherstellen" })
					.click();

				const restoreDialog = page.getByRole("dialog", {
					name: "Account wiederherstellen",
				});
				await expect(restoreDialog).toBeVisible();
				await expect(restoreDialog.getByText(testUser.email)).toBeVisible();

				await restoreDialog
					.getByRole("button", { name: "Wiederherstellen" })
					.click();

				await expect(restoreDialog).not.toBeVisible();

				// User should be active again
				await searchUser(page, testUser.email);
				await expect(
					userRow(page, testUser.email).getByText("active"),
				).toBeVisible();
			},
		);

		testWithUser(
			"admin can cancel the restore dialog without changing the user",
			async ({ page, testUser }) => {
				// Ban the user first via Supabase directly to keep the test focused
				await banUser(testUser.id);

				await gotoUserManagement(page);

				await searchUser(page, testUser.email);

				const editDialog = await openEditModal(page, testUser.email);
				await editDialog
					.getByRole("button", { name: "Account wiederherstellen" })
					.click();

				const restoreDialog = page.getByRole("dialog", {
					name: "Account wiederherstellen",
				});
				await expect(restoreDialog).toBeVisible();

				await restoreDialog.getByRole("button", { name: "Abbrechen" }).click();

				await expect(restoreDialog).not.toBeVisible();

				const closeUserEditDialogButton = page.getByRole("button", {
					name: "Close",
				});
				await closeUserEditDialogButton.click();

				// User should still be banned
				await searchUser(page, testUser.email);
				await expect(
					userRow(page, testUser.email).getByText("banned"),
				).toBeVisible();
			},
		);
	});

	testWithUser.describe("Delete user", () => {
		testWithUser(
			"admin can permanently delete a user",
			async ({ page, testUser }) => {
				await gotoUserManagement(page);

				await searchUser(page, testUser.email);

				const banDialog = await openBanOrDeleteDialog(page, testUser.email);

				// Switch to "Permanent löschen"
				await banDialog.locator("#delete").check();
				await expect(banDialog.locator("#delete")).toBeChecked();

				await banDialog
					.getByRole("button", { name: "Permanent löschen" })
					.click();

				// Both dialogs close
				await expect(
					page.getByRole("dialog", { name: "Account verwalten" }),
				).not.toBeVisible();
				await expect(
					page.getByRole("dialog", { name: "Benutzer bearbeiten" }),
				).not.toBeVisible();

				// User no longer appears in the table
				await searchUser(page, testUser.email);
				await expect(userRow(page, testUser.email)).not.toBeVisible();
			},
		);

		testWithUser(
			"admin can cancel permanent deletion without removing the user",
			async ({ page, testUser }) => {
				await gotoUserManagement(page);

				await searchUser(page, testUser.email);

				const banDialog = await openBanOrDeleteDialog(page, testUser.email);

				await banDialog.locator("#delete").check();
				await banDialog.getByRole("button", { name: "Abbrechen" }).click();

				// Dialog closes, user is still present
				await expect(
					page.getByRole("dialog", { name: "Account verwalten" }),
				).not.toBeVisible();

				const closeUserEditDialogButton = page.getByRole("button", {
					name: "Close",
				});
				await closeUserEditDialogButton.click();

				await searchUser(page, testUser.email);
				await expect(userRow(page, testUser.email)).toBeVisible();
			},
		);
	});
});

async function gotoUserManagement(page: Page) {
	await page.goto("/");
	await expect(
		page.getByRole("heading", { name: "Benutzerverwaltung" }),
	).toBeVisible();
	await expect(page.getByRole("table")).toBeVisible();
}

async function searchUser(page: Page, query: string) {
	await page.getByPlaceholder("Suche nach Name oder E-Mail...").fill(query);
}

function userRow(page: Page, email: string) {
	return page.getByRole("row").filter({ hasText: email });
}

async function openEditModal(page: Page, email: string) {
	const row = userRow(page, email);
	await expect(row).toBeVisible();
	await row.getByRole("button", { name: "Benutzer bearbeiten" }).click();
	const dialog = page.getByRole("dialog", { name: "Benutzer bearbeiten" });
	await expect(dialog).toBeVisible();
	return dialog;
}

async function openBanOrDeleteDialog(page: Page, email: string) {
	await openEditModal(page, email);
	const dialog = page.getByRole("dialog", { name: "Benutzer bearbeiten" });
	await dialog.getByRole("button", { name: "Benutzer verwalten" }).click();
	const banDialog = page.getByRole("dialog", { name: "Account verwalten" });
	await expect(banDialog).toBeVisible();
	return banDialog;
}

async function banUser(userId: string) {
	const { error } = await supabaseAdminClient.auth.admin.updateUserById(
		userId,
		{
			ban_duration: "876000h", // 1 year
		},
	);

	expect(error).toBeNull();
}
