import { expect, test } from "@playwright/test";
import { testDesktopOnly } from "../fixtures/test-desktop-only.ts";
import {
	deleteFileViaUI,
	mockDocumentUpload,
	uploadFileViaDragAndDrop,
	uploadFileViaFileChooser,
	uploadMultipleFilesViaFileChooser,
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
} from "../constants.ts";

test.describe("Documents", () => {
	testDesktopOnly(
		"Upload via file chooser & delete via UI",
		async ({ page, browserName }) => {
			await uploadFileViaFileChooser({
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
		"Upload max of 5 documents at once via file chooser",
		async ({ page, browserName }) => {
			// Test uploading exactly 5 documents (the max limit)
			const filesToUpload = defaultDocuments.slice(0, 5);

			await uploadMultipleFilesViaFileChooser({
				files: filesToUpload,
				page,
				browserName,
				uploadButtonName: "Datei hochladen",
			});

			// Verify all 5 files are visible in the document list
			for (const file of filesToUpload) {
				await expect(
					page.getByRole("button", { name: `Dokumente-Icon ${file.name}` }),
				).toBeVisible();
			}

			// Clean up: delete all uploaded files
			for (const file of filesToUpload) {
				await deleteFileViaUI({ page, fileName: file.name });
			}
		},
	);

	testDesktopOnly(
		"Attempt to upload more than 5 documents shows error for extras",
		async ({ page, browserName }) => {
			// Try to upload 6 documents (1 more than the max limit)
			const allFiles = defaultDocuments.slice(0, 6);
			const filesToUpload = allFiles.slice(0, 5);
			const fileToReject = allFiles[5];

			await page.goto("/");
			await page.waitForLoadState("networkidle");

			const filePaths = allFiles.map((file) => file.path);

			if (browserName === "firefox") {
				page.on("filechooser", async (fileChooser) => {
					await fileChooser.setFiles([]);
				});

				const fileInput = page.locator('input[type="file"]').first();
				await fileInput.setInputFiles(filePaths);
			} else {
				const fileChooserPromise = page.waitForEvent("filechooser");
				await page.getByRole("button", { name: "Datei hochladen" }).click();
				const fileChooser = await fileChooserPromise;
				await fileChooser.setFiles(filePaths);
			}

			// Wait for the error message for the rejected file
			await expect(page.getByText("Max. 5 Dateien pro Upload.")).toBeVisible();

			// Verify the first 5 files are being uploaded/uploaded successfully
			for (const file of filesToUpload) {
				await expect(page.getByText(file.name, { exact: true })).toBeVisible();
			}

			// Wait for successful uploads to complete
			for (let i = 0; i < 5; i++) {
				await page.waitForResponse(
					(givenResponse) =>
						givenResponse.url().includes("/documents/process") &&
						givenResponse.request().method() === "POST",
					{
						timeout: 60_000,
					},
				);
			}

			// Close the file upload dialog
			await page.getByRole("button", { name: "Ein blaues X-Icon" }).click();

			// Verify only the first 5 files appear in the document list
			for (const file of filesToUpload) {
				await expect(
					page.getByRole("button", { name: `Dokumente-Icon ${file.name}` }),
				).toBeVisible();
			}

			// Verify the 6th file is NOT in the document list
			await expect(
				page.getByRole("button", {
					name: `Dokumente-Icon ${fileToReject.name}`,
				}),
			).not.toBeVisible();

			// Clean up: delete all successfully uploaded files
			for (const file of filesToUpload) {
				await deleteFileViaUI({ page, fileName: file.name });
			}
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
				.getByRole("button", { name: "Neuer Ordner Plus-Icon" })
				.click();
			await page
				.getByRole("textbox", { name: "Ordner Name" })
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

			const folderCheckbox = page
				.locator("#desktop-documents-panel")
				.getByRole("listitem")
				.filter({ hasText: givenFolderName })
				.locator("label");
			await folderCheckbox.click();

			const deleteButton = page.getByRole("button", {
				name: "Löschen Mülleimer-Icon",
			});
			await deleteButton.click();

			const confirmButton = page.getByRole("button", {
				name: "Löschen",
				exact: true,
			});
			await confirmButton.click();

			// Verify the folder is deleted
			await expect(
				page.getByRole("button", { name: `Ordner-Icon ${givenFolderName}` }),
			).not.toBeVisible();
		},
	);

	testDesktopOnly(
		"Delete folder with a single document also deletes document",
		async ({ page }) => {
			const givenFolderName = "temp-folder-single";
			await page.goto("/");

			const createNewFolderButton = page.getByRole("button", {
				name: "Neuer Ordner Plus-Icon",
			});
			await createNewFolderButton.click();

			const folderNameInput = page.getByRole("textbox", {
				name: "Ordner Name",
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

			const folderCheckbox = page
				.locator("#desktop-documents-panel")
				.getByRole("listitem")
				.filter({ hasText: givenFolderName })
				.locator("label");
			await folderCheckbox.click();

			const deleteButton = page.getByRole("button", {
				name: "Löschen Mülleimer-Icon",
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
				.getByRole("button", { name: "Neuer Ordner Plus-Icon" })
				.click();
			await page.getByRole("textbox", { name: "Ordner Name" }).fill(folder);
			await page
				.getByRole("button", { name: "Erstellen", exact: true })
				.click();

			// Ensure second doc exists (upload if necessary)
			await uploadFileViaDragAndDrop({
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

			const folderCheckbox = page
				.locator("#desktop-documents-panel")
				.getByRole("listitem")
				.filter({ hasText: folder })
				.locator("label");
			await folderCheckbox.click();

			const deleteButton = page.getByRole("button", {
				name: "Löschen Mülleimer-Icon",
			});
			await deleteButton.click();

			const confirmButton = page.getByRole("button", {
				name: "Löschen",
				exact: true,
			});
			await confirmButton.click();

			// Assert folder gone and both docs gone
			await expect(
				page.getByRole("listitem").filter({ hasText: folder }),
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
				.getByRole("button", { name: "Neuer Ordner Plus-Icon" })
				.click();
			await page
				.getByRole("textbox", { name: "Ordner Name" })
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

	testDesktopOnly("Drag & drop document to upload", async ({ page }) => {
		await page.goto("/");

		await uploadFileViaDragAndDrop({
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
		await expect(page.getByRole("heading", { name: "Dateien" })).toBeVisible();

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
		await expect(
			page.getByRole("heading", { name: "Dateien" }),
		).not.toBeVisible();

		// Reopen the documents panel
		await page.getByRole("button", { name: "Anzeigen der Dateien" }).click();

		// The panel should be open again
		await expect(page.getByRole("heading", { name: "Dateien" })).toBeVisible();
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

			await uploadFileViaDragAndDrop({
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

			await uploadFileViaDragAndDrop({
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
			const maxFiles = Number(process.env.VITE_MAX_TOTAL_FILES_UPLOADED) || 30;

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

			// Verify the limit reached info messages are displayed
			await expect(
				page.getByText(`Sie haben das Limit von ${maxFiles} Dateien erreicht.`),
			).toBeVisible();
			await expect(
				page.getByText("Löschen Sie eine Datei, um eine neue hochzuladen."),
			).toBeVisible();

			// Verify the upload button is disabled
			const uploadButton = page.getByRole("button", {
				name: "Datei hochladen",
			});
			await expect(uploadButton).toBeDisabled();
		},
	);
});
