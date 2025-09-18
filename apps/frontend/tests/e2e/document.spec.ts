import { expect, test } from "@playwright/test";
import { testDesktopOnly } from "../fixtures/test-desktop-only.ts";
import {
	deleteFileViaUI,
	mockDocumentUpload,
	uploadFileViaDragAndDrop,
	uploadFileViaFileChooser,
} from "../fixtures/test-with-documents.ts";
import {
	defaultBucketName,
	defaultDocumentName,
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
		"Upload document with long name and verify truncation",
		async ({ page, account }) => {
			await mockDocumentUpload({
				userId: account.id,
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

			// Delete the folder
			await page
				.locator("#desktop-documents-panel")
				.getByRole("listitem")
				.filter({ hasText: "test-folder" })
				.locator("label")
				.click();
			await page
				.getByRole("button", { name: "Löschen Mülleimer-Icon" })
				.click();
			await page.getByRole("button", { name: "Löschen", exact: true }).click();

			// Verify the folder is deleted
			await expect(
				page.getByRole("listitem").filter({ hasText: givenFolderName }),
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
		expect(newPanelWidth).toBeLessThan(oldPanelWidth!);

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
});
