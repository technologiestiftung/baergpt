import { expect, test, type Request } from "@playwright/test";
import { testDesktopOnly } from "../fixtures/test-desktop-only.ts";
import {
	deleteFileViaUI,
	mockDocumentProcessing,
	mockDocumentUpload,
	attemptFileUploadViaFileChooser,
	attemptMultipleFilesViaFileChooser,
	uploadFileViaDragAndDropAndWait,
	uploadFileViaFileChooserAndWait,
} from "../fixtures/test-with-documents.ts";
import {
	defaultBucketName,
	defaultDocumentName,
	defaultDocumentPath,
	defaultDocuments,
	defaultSourceType,
	longFileName,
	longFilePath,
	msExcelDocumentName,
	msExcelDocumentPath,
	msExcelDocumentType,
	msWordDocumentName,
	msWordDocumentPath,
	msWordDocumentType,
	secondaryDocumentName,
	secondaryDocumentPath,
	secondaryDocumentType,
	seedDefaultDocumentName,
} from "../constants.ts";
import { supabaseAdminClient } from "../supabase.ts";
import { createClient } from "@supabase/supabase-js";
import { Database } from "@repo/db-schema";
import { config } from "../config.ts";

test.describe("Documents", () => {
	testDesktopOnly(
		"Upload via file chooser & delete via UI",
		async ({ page, browserName }) => {
			await uploadFileViaFileChooserAndWait({
				page,
				fileName: secondaryDocumentName,
				filePath: secondaryDocumentPath,
				browserName,
				uploadButtonName: "Datei hochladen",
			});
			await deleteFileViaUI({ page, fileName: defaultDocumentName });
		},
	);

	testDesktopOnly(
		"Attempt to upload more than 5 documents shows 6th document in waiting state",
		async ({ page, browserName, account }) => {
			// Try to upload 6 documents (1 more than the max limit)
			const allFiles = defaultDocuments.slice(0, 6);
			const filesToUploadFirst = allFiles.slice(0, 5);

			// Track which requests have been received and resolvers to control them
			const requestResolvers: Array<() => void> = [];

			// Mock the /documents/process route to control upload completion
			await page.route("**/documents/process", async (route) => {
				// Hold each request until we manually resolve it
				await new Promise<void>((resolve) => {
					requestResolvers.push(resolve);
				});
				return route.fulfill({ status: 204 });
			});

			attemptMultipleFilesViaFileChooser({
				files: allFiles,
				page,
				browserName,
				uploadButtonName: "Datei hochladen",
			});

			await expect.poll(() => requestResolvers.length).toBe(5);

			// Verify the first 5 files are shown with the state "Hochladen läuft"
			for (const file of filesToUploadFirst) {
				await expect(
					page
						.locator("#desktop-documents-panel")
						.getByText(`${file.name}Hochladen läuft`, { exact: true }),
				).toBeVisible();
			}

			// Verify the 6th file is shown with the state "Warte"
			await expect(
				page
					.locator("#desktop-documents-panel")
					.getByText(`${allFiles[5].name}Warte`, { exact: true }),
			).toBeVisible();

			// Mock the processing of the first file
			await mockDocumentProcessing({
				userId: account.id,
				sourceUrl: `${account.id}/${allFiles[0].name}`,
				accessGroupId: null,
				fileName: allFiles[0].name,
				sourceType: defaultSourceType,
			});

			// Resolve the first upload → 6th should transition from "Warte" to "Hochladen läuft"
			requestResolvers[0]();

			// Wait until the 6th request is intercepted (6th upload starts)
			await expect
				.poll(() => requestResolvers.length, { timeout: 30_000 })
				.toBe(6);

			// Verify the 6th file transitions to "Hochladen läuft"
			await expect(
				page
					.locator("#desktop-documents-panel")
					.getByText(`${allFiles[5].name}Hochladen läuft`, { exact: true }),
			).toBeVisible();

			// Resolve all remaining requests
			for (let i = 1; i < requestResolvers.length; i++) {
				await mockDocumentProcessing({
					userId: account.id,
					sourceUrl: `${account.id}/${allFiles[i].name}`,
					accessGroupId: null,
					fileName: allFiles[i].name,
					sourceType: defaultSourceType,
				});
				requestResolvers[i]();
			}

			// Close the file upload dialog
			await page.getByRole("button", { name: "Ein blaues X-Icon" }).click();

			// Verify all 6 files appear in the document list
			const desktopPanel = page.locator("#desktop-documents-panel");
			for (const file of allFiles) {
				await expect(
					desktopPanel.getByRole("button", {
						name: `Dokumente-Icon ${file.name}`,
					}),
				).toBeVisible();
			}

			// Clean up: delete all successfully uploaded files
			for (const file of allFiles) {
				await deleteFileViaUI({ page, fileName: file.name });
			}
		},
	);

	testDesktopOnly(
		"Should delete the file from storage when the processing fails",
		async ({ page, account, browserName, session }) => {
			const givenStoragePath = `${account.id}/${secondaryDocumentName}`;

			const givenFile = new File(["test content"], secondaryDocumentName, {
				type: secondaryDocumentType,
			});

			const localAnonClient = createClient<Database>(
				config.supabaseUrl,
				config.supabaseAnonKey,
			);

			const { error: sessionError } = await localAnonClient.auth.setSession({
				access_token: session.access_token,
				refresh_token: session.refresh_token,
			});

			expect(sessionError).toBeNull();

			const { error: uploadError } = await localAnonClient.storage
				.from("documents")
				.upload(givenStoragePath, givenFile);

			// Use scope local to avoid revoking the current access_token globally
			await localAnonClient.auth.signOut({ scope: "local" });

			expect(uploadError).toBeNull();

			const { data: exists1, error: existsError1 } =
				await supabaseAdminClient.storage
					.from(defaultBucketName)
					.exists(givenStoragePath);

			expect(existsError1).toBeNull();
			expect(exists1).toBe(true);

			const waitForDeletion = page.waitForResponse(
				(response) =>
					response.url().includes("/storage/v1/object/documents") &&
					response.request().method() === "DELETE",
			);

			await attemptFileUploadViaFileChooser({
				page,
				filePath: secondaryDocumentPath,
				browserName,
				uploadButtonName: "Datei hochladen",
			});

			await waitForDeletion;

			const { data: exists2, error: existsError2 } =
				await supabaseAdminClient.storage
					.from(defaultBucketName)
					.exists(givenStoragePath);

			/**
			 * If the file does not exist, supabase returns false + an error:
			 * https://github.com/supabase/supabase-js/issues/1363
			 * So we expect an error to be defined, but we also expect exists to be false.
			 */
			expect(existsError2).toBeDefined();
			expect(exists2).toBe(false);
		},
	);

	testDesktopOnly(
		"Upload document with long name and verify truncation",
		async ({ page, account, session }) => {
			await mockDocumentUpload({
				userId: account.id,
				accessToken: session.access_token,
				accessGroupId: null,
				fileName: longFileName,
				filePath: longFilePath,
				sourceType: defaultSourceType,
				bucketName: defaultBucketName,
			});

			await page.goto("/");

			// Find the document row with the long filename
			const longFileLocator = page
				.locator("li", {
					has: page.locator("span.truncate", { hasText: longFileName }),
				})
				.first();

			await expect(longFileLocator).toBeVisible();

			// Find the span element that contains the document name
			const documentNameSpan = longFileLocator.locator(
				"span.truncate.pointer-events-none",
			);
			await expect(documentNameSpan).toBeVisible();

			// Get the bounding box of the span containing the document name
			const spanBoundingBox = await documentNameSpan.boundingBox();
			expect(spanBoundingBox).toBeTruthy();

			// Get the bounding box of the parent container
			const containerBoundingBox = await longFileLocator.boundingBox();
			expect(containerBoundingBox).toBeTruthy();

			// Verify that the text is truncated by checking CSS properties
			const overflow = await documentNameSpan.evaluate(
				(el: HTMLSpanElement) => getComputedStyle(el).overflow,
			);
			const textOverflow = await documentNameSpan.evaluate(
				(el: HTMLSpanElement) => getComputedStyle(el).textOverflow,
			);
			const whiteSpace = await documentNameSpan.evaluate(
				(el: HTMLSpanElement) => getComputedStyle(el).whiteSpace,
			);

			// The truncate class should set overflow: hidden, text-overflow: ellipsis, white-space: nowrap
			expect(overflow).toBe("hidden");
			expect(textOverflow).toBe("ellipsis");
			expect(whiteSpace).toBe("nowrap");

			// Verify that the actual displayed text width is constrained
			const textWidth = await documentNameSpan.evaluate(
				(el: HTMLSpanElement) => el.scrollWidth,
			);
			const visibleWidth = await documentNameSpan.evaluate(
				(el: HTMLSpanElement) => el.clientWidth,
			);

			// If text is truncated, scrollWidth should be greater than clientWidth
			expect(textWidth).toBeGreaterThan(visibleWidth);

			// Test tooltip functionality on hover
			await documentNameSpan.hover();

			// Wait for tooltip to appear (it has a 600ms delay)
			await page.waitForTimeout(700);

			// Check if tooltip is visible with the full filename
			const tooltip = page.locator('[data-testid="tooltip"]');
			if (await tooltip.isVisible()) {
				const tooltipContent = await tooltip.innerHTML();
				expect(tooltipContent).toContain(longFileName);
			}
		},
	);

	testDesktopOnly(
		"Create, move a document into / out of a folder, and delete a folder",
		async ({ page }) => {
			const givenFolderName = "test-folder";

			await page.goto("/");

			// Create a new folder
			await page
				.getByRole("button", { name: "Ordner-Icon Ordner erstellen" })
				.click();
			await page
				.getByRole("textbox", { name: "Neuer Ordner" })
				.fill(givenFolderName);
			await page
				.getByRole("button", { name: "Erstellen", exact: true })
				.click();

			// Verify the folder is created
			await expect(
				page.getByRole("listitem").filter({ hasText: givenFolderName }),
			).toBeVisible();

			// Move a document into the folder
			await page
				.getByRole("button", { name: `Dokumente-Icon ${defaultDocumentName}` })
				.hover();
			await page.mouse.down();
			await page
				.getByRole("button", { name: `Ordner-Icon ${givenFolderName}` })
				.hover();
			await page.mouse.up();

			// Verify the document is no longer visible in the parent folder
			await expect(
				await page.getByRole("button", {
					name: `Dokumente-Icon ${defaultDocumentName}`,
				}),
			).not.toBeVisible();

			// Navigate into the folder where the document was moved
			await page
				.getByRole("button", { name: `Ordner-Icon ${givenFolderName}` })
				.click();

			// Verify the document is visible inside the child folder
			await expect(
				await page.getByRole("button", {
					name: `Dokumente-Icon ${defaultDocumentName}`,
				}),
			).toBeVisible();

			// Move the document out of the child folder
			await page
				.getByRole("button", { name: `Dokumente-Icon ${defaultDocumentName}` })
				.hover();
			await page.mouse.down();
			await page.getByRole("button", { name: "Meine Dateien" }).hover();
			await page.mouse.up();

			// Verify the document is no longer visible in the child folder
			await expect(
				await page.getByRole("button", {
					name: `Dokumente-Icon ${defaultDocumentName}`,
				}),
			).not.toBeVisible();

			// Navigate back to the parent folder
			await page.getByRole("button", { name: "Meine Dateien" }).click();

			// Verify the document is visible in the parent folder again
			await expect(
				await page.getByRole("button", {
					name: `Dokumente-Icon ${defaultDocumentName}`,
				}),
			).toBeVisible();

			// Enter multi-select mode (checkboxes for delete appear), skip if already in multi-select
			const enterMultiSelectButton = page.getByRole("button", {
				name: "Checkbox-Icon (ausgewählt) Dateien auswählen",
			});
			if (await enterMultiSelectButton.isVisible()) {
				await enterMultiSelectButton.click();
			}

			const folderCheckbox = page
				.locator("#desktop-documents-panel")
				.getByRole("listitem")
				.filter({ hasText: givenFolderName })
				.locator("label");
			await folderCheckbox.click();

			await page
				.getByRole("button", { name: "Button klicken, um Elemente zu löschen" })
				.click();

			await page
				.getByRole("dialog")
				.getByRole("button", { name: "Löschen" })
				.click();

			// Verify the folder is deleted
			await expect(
				page.getByRole("button", { name: `Ordner-Icon ${givenFolderName}` }),
			).not.toBeVisible();
		},
	);

	testDesktopOnly(
		"Move two files to a folder via drag and drop and back to root",
		async ({ page, account, session }) => {
			const folderName = "test-folder-dnd-multi";

			await mockDocumentUpload({
				userId: account.id,
				accessToken: session.access_token,
				accessGroupId: null,
				fileName: secondaryDocumentName,
				filePath: secondaryDocumentPath,
				sourceType: defaultSourceType,
				bucketName: defaultBucketName,
			});

			await page.goto("/");

			// Create a new folder
			await page
				.getByRole("button", { name: "Ordner-Icon Ordner erstellen" })
				.click();
			await page
				.getByRole("textbox", { name: "Neuer Ordner" })
				.fill(folderName);
			await page
				.getByRole("button", { name: "Erstellen", exact: true })
				.click();

			const desktopPanel = page.locator("#desktop-documents-panel");
			const fileNames = [defaultDocumentName, secondaryDocumentName] as const;

			// Enter multi-select mode
			await page
				.getByRole("button", {
					name: "Checkbox-Icon (ausgewählt) Dateien auswählen",
				})
				.click();

			// Select both files via their checkboxes
			for (const name of fileNames) {
				await desktopPanel
					.getByRole("listitem")
					.filter({ hasText: name })
					.locator("label")
					.first()
					.click();
			}

			// Drag one file onto the folder — both selected files move together
			await page
				.getByRole("button", { name: `Dokumente-Icon ${defaultDocumentName}` })
				.hover();
			await page.mouse.down();
			await page
				.getByRole("button", { name: `Ordner-Icon ${folderName}` })
				.hover();
			await page.mouse.up();

			// Verify both files are no longer visible in the root folder
			for (const name of fileNames) {
				await expect(
					page.getByRole("button", { name: `Dokumente-Icon ${name}` }),
				).not.toBeVisible();
			}

			// Navigate into the folder and verify both files are visible
			await page
				.getByRole("button", { name: `Ordner-Icon ${folderName}` })
				.click();

			for (const name of fileNames) {
				await expect(
					page.getByRole("button", { name: `Dokumente-Icon ${name}` }),
				).toBeVisible();
			}

			// Select both files again
			for (const name of fileNames) {
				await desktopPanel
					.getByRole("listitem")
					.filter({ hasText: name })
					.locator("label")
					.first()
					.click();
			}

			// Drag one file onto the breadcrumb — both move back to root
			await page
				.getByRole("button", { name: `Dokumente-Icon ${defaultDocumentName}` })
				.hover();
			await page.mouse.down();
			await page.getByRole("button", { name: "Meine Dateien" }).hover();
			await page.mouse.up();

			// Verify both files are no longer visible inside the folder
			for (const name of fileNames) {
				await expect(
					page.getByRole("button", { name: `Dokumente-Icon ${name}` }),
				).not.toBeVisible();
			}

			// Navigate back to root and verify both files are visible
			await page.getByRole("button", { name: "Meine Dateien" }).click();

			for (const name of fileNames) {
				await expect(
					page.getByRole("button", { name: `Dokumente-Icon ${name}` }),
				).toBeVisible();
			}
		},
	);

	testDesktopOnly(
		"Delete folder with a single document also deletes document",
		async ({ page }) => {
			const givenFolderName = "temp-folder-single";
			await page.goto("/");

			const createNewFolderButton = page.getByRole("button", {
				name: "Ordner-Icon Ordner erstellen",
			});
			await createNewFolderButton.click();

			const folderNameInput = page.getByRole("textbox", {
				name: "Neuer Ordner",
			});
			await folderNameInput.fill(givenFolderName);

			const createFolderButton = page.getByRole("button", {
				name: "Erstellen",
				exact: true,
			});
			await createFolderButton.click();

			const folderElement = page.getByRole("button", {
				name: `Ordner-Icon ${givenFolderName}`,
			});
			await expect(folderElement).toBeVisible();

			const documentElement = page.getByRole("button", {
				name: `Dokumente-Icon ${defaultDocumentName}`,
			});
			await documentElement.hover();
			await page.mouse.down();

			await folderElement.hover();
			await page.mouse.up();

			// Enter multi-select mode (checkboxes for delete appear), skip if already in multi-select
			const enterMultiSelectButton = page.getByRole("button", {
				name: "Checkbox-Icon (ausgewählt) Dateien auswählen",
			});
			if (await enterMultiSelectButton.isVisible()) {
				await enterMultiSelectButton.click();
			}

			const folderCheckbox = page
				.locator("#desktop-documents-panel")
				.getByRole("listitem")
				.filter({ hasText: givenFolderName })
				.locator("label");
			await folderCheckbox.click();

			// Open the delete dialog
			const deleteButton = page.getByRole("button", {
				name: "Button klicken, um Elemente zu löschen",
			});
			await deleteButton.click();

			const confirmButton = page.getByRole("button", {
				name: "Löschen",
				exact: true,
			});
			await confirmButton.click();

			// Assert folder gone
			await expect(
				page.getByRole("button", {
					name: `Ordner-Icon ${givenFolderName}`,
				}),
			).not.toBeVisible();

			// Assert document gone as well (no longer visible anywhere)
			await expect(
				page.getByRole("button", {
					name: `Dokumente-Icon ${defaultDocumentName}`,
				}),
			).not.toBeVisible();
		},
	);

	testDesktopOnly(
		"Delete folder with multiple documents deletes them all",
		async ({ page }) => {
			const folder = "temp-folder-multi";
			await page.goto("/");

			// Create folder
			await page
				.getByRole("button", { name: "Ordner-Icon Ordner erstellen" })
				.click();
			await page.getByRole("textbox", { name: "Neuer Ordner" }).fill(folder);
			await page
				.getByRole("button", { name: "Erstellen", exact: true })
				.click();

			// Ensure second doc exists (upload if necessary)
			await uploadFileViaDragAndDropAndWait({
				page,
				fileName: secondaryDocumentName,
				filePath: secondaryDocumentPath,
				fileType: secondaryDocumentType,
			});

			// Move both into the folder
			for (const name of [defaultDocumentName, secondaryDocumentName]) {
				await page
					.getByRole("button", { name: `Dokumente-Icon ${name}` })
					.hover();
				await page.mouse.down();
				await page
					.getByRole("button", { name: `Ordner-Icon ${folder}` })
					.hover();
				await page.mouse.up();
			}

			// Enter multi-select mode (checkboxes for delete appear), skip if already in multi-select
			const enterMultiSelectButton = page.getByRole("button", {
				name: "Checkbox-Icon (ausgewählt) Dateien auswählen",
			});
			if (await enterMultiSelectButton.isVisible()) {
				await enterMultiSelectButton.click();
			}

			const folderCheckbox = page
				.locator("#desktop-documents-panel")
				.getByRole("listitem")
				.filter({ hasText: folder })
				.locator("label");
			await folderCheckbox.click();

			const deleteButton = page.getByRole("button", {
				name: "Button klicken, um Elemente zu löschen",
			});
			await deleteButton.click();

			const confirmButton = page.getByRole("button", {
				name: "Löschen",
				exact: true,
			});
			await confirmButton.click();

			// Assert folder gone and both docs gone
			await expect(
				page
					.locator("#desktop-documents-panel")
					.getByRole("listitem")
					.filter({
						has: page.getByRole("button", {
							name: `Ordner-Icon ${folder}`,
						}),
					}),
			).not.toBeVisible();
			for (const name of [defaultDocumentName, secondaryDocumentName]) {
				await expect(
					page.getByRole("button", { name: `Dokumente-Icon ${name}` }),
				).not.toBeVisible();
			}
		},
	);

	testDesktopOnly(
		"Delete Document and Folder via dropdown",
		async ({ page }) => {
			const givenFolderName = "test-folder";

			await page.goto("/");

			const menuButtonDocument = page
				.getByRole("listitem")
				.filter({ hasText: defaultDocumentName })
				.getByLabel("Menü öffnen");
			await expect(menuButtonDocument).toBeVisible();

			await menuButtonDocument.click();

			// Expect delete button in dropdown to be visible and click it
			await expect(
				page.getByRole("option", { name: "Dokument löschen" }),
			).toBeVisible();
			await page.getByRole("option", { name: "Dokument löschen" }).click();

			// Expect delete dialog to be visible and confirm deletion
			await expect(page.getByRole("dialog")).toBeVisible();
			await page.getByRole("button", { name: "Löschen", exact: true }).click();

			// Expect document to be deleted
			await expect(
				page.getByRole("button", {
					name: `Dokumente-Icon ${defaultDocumentName}`,
				}),
			).not.toBeVisible();

			// Create a new folder
			await page
				.getByRole("button", { name: "Ordner-Icon Ordner erstellen" })
				.click();
			await page
				.getByRole("textbox", { name: "Neuer Ordner" })
				.fill(givenFolderName);
			await page
				.getByRole("button", { name: "Erstellen", exact: true })
				.click();

			// Verify the folder is created
			await expect(
				page.getByRole("listitem").filter({ hasText: givenFolderName }),
			).toBeVisible();

			const menuButtonFolder = page
				.getByRole("listitem")
				.filter({ hasText: givenFolderName })
				.getByLabel("Menü öffnen");
			await expect(menuButtonFolder).toBeVisible();

			await menuButtonFolder.click();

			// Expect delete button in dropdown to be visible and click it
			await expect(
				page.getByRole("option", { name: "Ordner löschen" }),
			).toBeVisible();
			await page.getByRole("option", { name: "Ordner löschen" }).click();

			// Expect delete dialog to be visible and confirm deletion
			await expect(page.getByRole("dialog")).toBeVisible();
			await page.getByRole("button", { name: "Löschen", exact: true }).click();

			// Expect folder to be deleted
			await expect(
				page.getByRole("button", { name: `Ordner-Icon ${givenFolderName}` }),
			).not.toBeVisible();
		},
	);

	testDesktopOnly("Rename a folder via dropdown", async ({ page }) => {
		const givenFolderName = "test-folder-rename";
		const expectedFolderName = "test-folder-renamed";

		await page.goto("/");

		// Create a new folder
		await page
			.getByRole("button", { name: "Ordner-Icon Ordner erstellen" })
			.click();
		await page
			.getByRole("textbox", { name: "Neuer Ordner" })
			.fill(givenFolderName);
		await page.getByRole("button", { name: "Erstellen", exact: true }).click();

		// Verify the folder is created
		const folderElement = page.getByRole("button", {
			name: `Ordner-Icon ${givenFolderName}`,
			exact: true,
		});
		await expect(folderElement).toBeVisible();

		const menuButtonFolder = page
			.getByRole("listitem")
			.filter({ hasText: givenFolderName })
			.getByLabel("Menü öffnen");
		await menuButtonFolder.click();

		// Expect rename button in dropdown to be visible and click it
		const renameOption = page.getByRole("option", {
			name: "Ordner umbenennen",
		});
		await expect(renameOption).toBeVisible();
		await renameOption.click();

		// Expect the dialog to be prefilled with the current folder name
		const renameInput = page.getByRole("textbox", {
			name: "Ordner umbenennen",
		});
		await expect(renameInput).toBeVisible();
		await expect(renameInput).toHaveValue(givenFolderName);

		// Rename the folder and confirm
		await renameInput.fill(expectedFolderName);
		await page.getByRole("button", { name: "Umbenennen", exact: true }).click();

		// Expect the folder to be renamed
		await expect(
			page.getByRole("button", {
				name: `Ordner-Icon ${expectedFolderName}`,
				exact: true,
			}),
		).toBeVisible();
		await expect(folderElement).not.toBeVisible();
	});

	testDesktopOnly(
		"Renaming a folder to an empty name is rejected",
		async ({ page }) => {
			const givenFolderName = "test-folder-empty-rename";

			await page.goto("/");

			// Create a new folder
			await page
				.getByRole("button", { name: "Ordner-Icon Ordner erstellen" })
				.click();
			await page
				.getByRole("textbox", { name: "Neuer Ordner" })
				.fill(givenFolderName);
			await page
				.getByRole("button", { name: "Erstellen", exact: true })
				.click();

			// Open the rename dialog via the dropdown
			const menuButtonFolder = page
				.getByRole("listitem")
				.filter({ hasText: givenFolderName })
				.getByLabel("Menü öffnen");
			await menuButtonFolder.click();
			await page.getByRole("option", { name: "Ordner umbenennen" }).click();

			// Submit a name that only consists of whitespace
			const renameInput = page.getByRole("textbox", {
				name: "Ordner umbenennen",
			});
			await renameInput.fill("   ");
			await page
				.getByRole("button", { name: "Umbenennen", exact: true })
				.click();

			// The dialog stays open so the name can be corrected
			await expect(page.getByRole("dialog")).toBeVisible();

			// The folder keeps its original name
			await expect(
				page.getByRole("button", { name: `Ordner-Icon ${givenFolderName}` }),
			).toBeVisible();
		},
	);

	testDesktopOnly(
		"Documents cannot be renamed via dropdown",
		async ({ page }) => {
			await page.goto("/");

			const menuButtonDocument = page
				.getByRole("listitem")
				.filter({ hasText: defaultDocumentName })
				.getByLabel("Menü öffnen");
			await menuButtonDocument.click();

			await expect(
				page.getByRole("option", { name: "Dokument anzeigen" }),
			).toBeVisible();

			// Renaming is only available for the user's own folders
			await expect(
				page.getByRole("option", { name: "Ordner umbenennen" }),
			).not.toBeVisible();
		},
	);

	testDesktopOnly("Drag & drop document to upload", async ({ page }) => {
		await page.goto("/");

		await uploadFileViaDragAndDropAndWait({
			page,
			fileName: secondaryDocumentName,
			filePath: secondaryDocumentPath,
			fileType: secondaryDocumentType,
		});

		await deleteFileViaUI({ page, fileName: secondaryDocumentName });
	});

	testDesktopOnly("Interact with documents panel", async ({ page }) => {
		await page.goto("/");

		// The panel should be open by default
		const documentPanelHeading = page.getByRole("heading", {
			name: "Dateien",
			exact: true,
		});
		await expect(documentPanelHeading).toBeVisible();

		const oldPanelWidth = await page.evaluate(
			() => document.getElementById("desktop-documents-panel")?.clientWidth,
		);

		expect(oldPanelWidth).toBeDefined();

		if (!oldPanelWidth) {
			throw new Error("oldPanelWidth is undefined");
		}

		// Increment to resize the panel
		const increment = 100;

		const resizer = page.locator("#desktop-document-panel-resizer");

		// Increase the width of the documents panel
		await resizer.hover();
		await page.mouse.down();
		await page.mouse.move(increment, 0);
		await page.mouse.up();

		// Sometimes the width is evaluated before the resize ends,
		// so we have to wait for the resizing to finish
		await expect(resizer).toHaveAttribute("data-is-resizing", "false");

		const newPanelWidth = await page.evaluate(
			() => document.getElementById("desktop-documents-panel")?.clientWidth,
		);

		// The panel width should have decreased
		expect(newPanelWidth).toBeLessThan(oldPanelWidth);

		// Close the documents panel
		await page.getByRole("button", { name: "Ausblenden der Dateien" }).click();

		// The panel should be closed
		await expect(documentPanelHeading).not.toBeVisible();

		// Reopen the documents panel
		await page.getByRole("button", { name: "Anzeigen der Dateien" }).click();

		// The panel should be open again
		await expect(documentPanelHeading).toBeVisible();
	});

	testDesktopOnly(
		"Click on a pdf document to open a preview, then download it",
		async ({ page }) => {
			await page.goto("/");
			// Click on the document to open the preview
			await page
				.getByRole("button", { name: `Dokumente-Icon ${defaultDocumentName}` })
				.click();

			// Expect the preview to be visible
			await expect(
				page.getByRole("heading", { name: defaultDocumentName }),
			).toBeVisible();

			// Download the document from the preview
			const downloadPromise = page.waitForEvent("download");
			await page
				.getByRole("link", { name: `${defaultDocumentName} herunterladen` })
				.click();
			const download = await downloadPromise;

			// Verify the download was successful
			expect(download).toBeDefined();
			expect(await download.path()).toBeTruthy();
		},
	);

	testDesktopOnly(
		"Open pdf document preview via dropdown",
		async ({ page }) => {
			await page.goto("/");

			const menuButtonDocument = page
				.getByRole("listitem")
				.filter({ hasText: defaultDocumentName })
				.getByLabel("Menü öffnen");
			await expect(menuButtonDocument).toBeVisible();

			await menuButtonDocument.click();

			// Expect view button in dropdown to be visible and click it
			await expect(
				page.getByRole("option", { name: "Dokument anzeigen" }),
			).toBeVisible();
			await page.getByRole("option", { name: "Dokument anzeigen" }).click();

			// Expect preview to be visible
			await expect(
				page.getByRole("heading", { name: defaultDocumentName }),
			).toBeVisible();
		},
	);

	testDesktopOnly(
		"Upload word document, open it in the preview, then download it",
		async ({ page }) => {
			await page.goto("/");

			await uploadFileViaDragAndDropAndWait({
				page,
				fileName: msWordDocumentName,
				filePath: msWordDocumentPath,
				fileType: msWordDocumentType,
			});

			// Click on the document to open the preview
			await page
				.getByRole("button", { name: `Dokumente-Icon ${msWordDocumentName}` })
				.click();

			// Expect the preview to be visible
			await expect(
				page.getByRole("heading", { name: msWordDocumentName }),
			).toBeVisible();

			// Download the document from the preview
			const downloadPromise = page.waitForEvent("download", {
				predicate: (download) =>
					download.suggestedFilename() === msWordDocumentName,
			});
			await page
				.getByRole("link", { name: `${msWordDocumentName} herunterladen` })
				.click();
			const download = await downloadPromise;

			// Verify the download was successful
			expect(download).toBeDefined();
			expect(await download.path()).toBeTruthy();
		},
	);

	testDesktopOnly(
		"Upload excel document, open it in the preview, then download it",
		async ({ page }) => {
			await page.goto("/");

			await uploadFileViaDragAndDropAndWait({
				page,
				fileName: msExcelDocumentName,
				filePath: msExcelDocumentPath,
				fileType: msExcelDocumentType,
			});

			// Click on the document to open the preview
			await page
				.getByRole("button", { name: `Dokumente-Icon ${msExcelDocumentName}` })
				.click();

			// Expect the preview to be visible
			await expect(
				page.getByRole("heading", { name: msExcelDocumentName }),
			).toBeVisible();

			// Download the document from the preview
			const downloadPromise = page.waitForEvent("download", {
				predicate: (download) =>
					download.suggestedFilename() === msExcelDocumentName,
			});
			await page
				.getByRole("link", { name: `${msExcelDocumentName} herunterladen` })
				.click();
			const download = await downloadPromise;

			// Verify the download was successful
			expect(download).toBeDefined();
			expect(await download.path()).toBeTruthy();
		},
	);

	testDesktopOnly(
		"Shows limit reached message and disables upload button when max files uploaded",
		async ({ page, account, session }) => {
			const maxFiles = Number(process.env.VITE_MAX_TOTAL_FILES_UPLOADED) || 100;

			// Mock multiple document uploads to reach the limit
			// We already have 1 document from the fixture, so upload (maxFiles - 1) more
			for (let i = 1; i < maxFiles; i++) {
				await mockDocumentUpload({
					userId: account.id,
					accessToken: session.access_token,
					accessGroupId: null,
					fileName: `test-document-${i}.pdf`,
					filePath: defaultDocumentPath,
					sourceType: defaultSourceType,
					bucketName: defaultBucketName,
				});
			}

			await page.goto("/");
			await page.waitForLoadState("networkidle");

			// Verify the limit reached info messages are displayed (scope to desktop panel)
			const desktopPanel = page.locator("#desktop-documents-panel");
			await expect(
				desktopPanel.getByText(
					`Sie haben das Limit von ${maxFiles} Dateien erreicht.`,
				),
			).toBeVisible();
			await expect(
				desktopPanel.getByText(
					"Löschen Sie eine Datei, um eine neue hochzuladen.",
				),
			).toBeVisible();

			// Verify the upload button is disabled
			const uploadButton = desktopPanel.getByRole("button", {
				name: "Datei hochladen",
			});
			await expect(uploadButton).toBeDisabled();
		},
	);

	testDesktopOnly(
		"Hidden default documents do not count toward upload limit",
		async ({ page, account, session }) => {
			const maxFiles = Number(process.env.VITE_MAX_TOTAL_FILES_UPLOADED) || 100;

			// Fixture has 1 personal doc; mock 98 more → 99 personal. With 1 default (created above) = 100 visible (at limit)
			for (let i = 1; i < maxFiles - 1; i++) {
				await mockDocumentUpload({
					userId: account.id,
					accessToken: session.access_token,
					accessGroupId: null,
					fileName: `test-document-edge-${i}.pdf`,
					filePath: defaultDocumentPath,
					sourceType: defaultSourceType,
					bucketName: defaultBucketName,
				});
			}

			await page.goto("/");
			await page.waitForLoadState("networkidle");

			const desktopPanel = page.locator("#desktop-documents-panel");

			// At 100 visible → limit reached
			await expect(
				desktopPanel.getByText(
					`Sie haben das Limit von ${maxFiles} Dateien erreicht.`,
				),
			).toBeVisible();
			const uploadButton = desktopPanel.getByRole("button", {
				name: "Datei hochladen",
			});
			await expect(uploadButton).toBeDisabled();

			// Delete (hide) the seed default document via UI → 99 visible, one slot free
			await deleteFileViaUI({ page, fileName: seedDefaultDocumentName });

			// Wait for document list refetch and UI to reflect 99 visible (hidden default no longer counted)
			await expect(
				desktopPanel.getByText(`${maxFiles - 1} von ${maxFiles}`),
			).toBeVisible({ timeout: 15_000 });
			await expect(uploadButton).toBeEnabled();

			// Upload the 100th visible file using setInputFiles to simulate user file selection
			await mockDocumentUpload({
				userId: account.id,
				accessToken: session.access_token,
				accessGroupId: null,
				fileName: secondaryDocumentName,
				filePath: secondaryDocumentPath,
				sourceType: "personal_document",
				bucketName: defaultBucketName,
			});
			await page.goto("/");

			// Now at 100 visible → limit reached again
			await expect(
				desktopPanel.getByText(
					`Sie haben das Limit von ${maxFiles} Dateien erreicht.`,
				),
			).toBeVisible();
			await expect(uploadButton).toBeDisabled();
		},
	);

	testDesktopOnly(
		"Move a document into the public folder Verwaltungswissen should not be possible",
		async ({ page }) => {
			await page.goto("/");

			// Verify the Verwaltungswissen folder exists
			const publicFolder = page.getByRole("button", {
				name: "Ordner-Icon Verwaltungswissen",
			});
			await expect(publicFolder).toBeVisible();

			// Attempt to drag a document onto the Verwaltungswissen folder
			await page
				.getByRole("button", { name: `Dokumente-Icon ${defaultDocumentName}` })
				.hover();
			await page.mouse.down();
			await publicFolder.hover();
			await page.mouse.up();

			// Verify the document is still visible in the root folder (move was rejected)
			await expect(
				page.getByRole("button", {
					name: `Dokumente-Icon ${defaultDocumentName}`,
				}),
			).toBeVisible();
		},
	);

	testDesktopOnly(
		"File upload is not visible when inside the public folder Verwaltungswissen",
		async ({ page }) => {
			await page.goto("/");

			const desktopPanel = page.locator("#desktop-documents-panel");

			// Navigate into the Verwaltungswissen folder
			const publicFolder = page.getByRole("button", {
				name: "Ordner-Icon Verwaltungswissen",
			});
			await expect(publicFolder).toBeVisible();
			await publicFolder.click();

			// Verify the upload button is not visible
			await expect(
				desktopPanel.getByRole("button", { name: "Datei hochladen" }),
			).not.toBeVisible();

			// Verify the drag & drop overlay is not rendered (drop zone is disabled)
			await expect(
				desktopPanel.locator("input[type='file']"),
			).not.toBeAttached();
		},
	);

	testDesktopOnly(
		"Cannot drag & drop a file to upload when inside the public folder Verwaltungswissen",
		async ({ page }) => {
			await page.goto("/");

			// Navigate into the Verwaltungswissen folder
			const publicFolder = page.getByRole("button", {
				name: "Ordner-Icon Verwaltungswissen",
			});
			await expect(publicFolder).toBeVisible();
			await publicFolder.click();

			// Prepare a file for drag and drop
			const buffer = (await import("node:fs"))
				.readFileSync(secondaryDocumentPath)
				.toString("base64");

			const dataTransfer = await page.evaluateHandle(
				async ({ bufferData, localFileName, localFileType }) => {
					const dt = new DataTransfer();
					const blob = await fetch(bufferData).then((res) => res.blob());
					const file = new File([blob], localFileName, { type: localFileType });
					dt.items.add(file);
					return dt;
				},
				{
					bufferData: `data:application/octet-stream;base64,${buffer}`,
					localFileName: secondaryDocumentName,
					localFileType: secondaryDocumentType,
				},
			);

			let uploadRequestTriggered = false;
			const onRequest = (request: Request) => {
				if (
					request.method() === "POST" &&
					request.url().includes("/documents/process")
				) {
					uploadRequestTriggered = true;
				}
			};
			page.on("request", onRequest);

			// Attempt drag & drop on the documents panel
			const desktopPanel = page.locator("#desktop-documents-panel");
			await desktopPanel.dispatchEvent("dragenter", { dataTransfer });
			await desktopPanel.dispatchEvent("dragover", { dataTransfer });
			await desktopPanel.dispatchEvent("drop", { dataTransfer });

			const documentUpload = desktopPanel.getByText(secondaryDocumentName);
			await expect(documentUpload).not.toBeVisible({ timeout: 1_000 });
			expect(uploadRequestTriggered).toBe(false);

			page.off("request", onRequest);
		},
	);

	testDesktopOnly(
		"Navigating into a public folder should disable the multi-select",
		async ({ page }) => {
			await page.goto("/");

			const activateMultiSelectButton = page.getByRole("button", {
				name: "Checkbox-Icon (ausgewählt) Dateien auswählen",
			});
			await activateMultiSelectButton.click();

			const firstSelectItemCheckbox = page
				.getByRole("img", { name: "Checkbox-icon (nicht ausgewä" })
				.first();
			await expect(firstSelectItemCheckbox).toBeVisible();

			const publicFolder = page.getByRole("button", {
				name: "Ordner-Icon Verwaltungswissen",
			});
			await publicFolder.click();

			await expect(firstSelectItemCheckbox).not.toBeVisible();
		},
	);
});
