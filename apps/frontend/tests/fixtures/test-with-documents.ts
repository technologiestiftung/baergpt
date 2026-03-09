import { supabaseAdminClient } from "../supabase.ts";
import { testWithLoggedInUser } from "./test-with-logged-in-user.ts";
import { expect, Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { config } from "../config.ts";
import type { Database } from "@repo/db-schema";
import {
	defaultDocumentName,
	defaultDocumentPath,
	chunk_index,
	chunk_mistral_embedding,
	content,
	created_at,
	file_checksum,
	file_size,
	folder_id,
	num_pages,
	page as pageNumber,
	processing_finished_at,
	short_summary,
	summary,
	tags,
	defaultSourceType,
	defaultBucketName,
} from "../constants.ts";
import { readFileSync } from "node:fs";

export const testWithDocuments = testWithLoggedInUser.extend<{
	documentChunkId: number;
}>({
	documentChunkId: [
		async ({ account, session }, use) => {
			/**
			 * This happens before each test that uses this fixture.
			 */
			const documentChunkId = await mockDocumentUpload({
				userId: account.id,
				accessToken: session.access_token,
				accessGroupId: null,
				fileName: defaultDocumentName,
				filePath: defaultDocumentPath,
				sourceType: defaultSourceType,
				bucketName: defaultBucketName,
			});

			/**
			 * This runs the test that uses this fixture.
			 */
			await use(documentChunkId);

			/**
			 * This happens after each test that uses this fixture.
			 */
			await cleanup(account.id);
		},
		{ auto: true },
	],
});

export async function mockDocumentUpload({
	userId,
	accessToken,
	accessGroupId,
	fileName,
	filePath,
	sourceType,
	bucketName,
}: {
	userId: string;
	accessToken: string;
	accessGroupId: string | null;
	fileName: string;
	filePath: string;
	sourceType: "public_document" | "personal_document" | "default_document";
	bucketName: "documents" | "public_documents";
}) {
	// For default documents, use accessGroupId in source_url; otherwise use userId
	const source_url =
		sourceType === "default_document" && accessGroupId
			? `${accessGroupId}/${fileName}`
			: `${userId}/${fileName}`;
	const file = new Uint8Array(readFileSync(filePath));

	// Use admin client for default documents to bypass RLS, otherwise use user client
	const storageClient =
		sourceType === "default_document"
			? supabaseAdminClient
			: createClient<Database>(config.supabaseUrl, config.supabaseAnonKey, {
					global: { headers: { Authorization: `Bearer ${accessToken}` } },
				});

	const uploadOptions =
		sourceType === "default_document" ? { upsert: true } : undefined;

	const { error: uploadError } = await storageClient.storage
		.from(bucketName)
		.upload(
			source_url,
			new File([file], fileName, { type: "application/pdf" }),
			uploadOptions,
		);

	expect(uploadError).toBeNull();

	const { data: documentData, error: documentsInsertError } =
		await supabaseAdminClient
			.from("documents")
			.insert({
				owned_by_user_id: accessGroupId ? null : userId,
				access_group_id: accessGroupId,
				uploaded_by_user_id: accessGroupId ? userId : null,
				source_type: sourceType,
				source_url,
				file_name: fileName,
				file_checksum,
				file_size,
				num_pages,
				folder_id,
				created_at,
				processing_finished_at,
			})
			.select()
			.single();

	expect(documentsInsertError).toBeNull();

	if (documentsInsertError !== null) {
		throw documentsInsertError;
	}

	const { error: documentSummariesInsertError } = await supabaseAdminClient
		.from("document_summaries")
		.insert({
			owned_by_user_id: accessGroupId ? null : userId,
			access_group_id: accessGroupId,
			document_id: documentData.id,
			folder_id,
			summary,
			tags,
			short_summary,
		});

	expect(documentSummariesInsertError).toBeNull();

	const { data: chunkData, error: documentChunksInsertError } =
		await supabaseAdminClient
			.from("document_chunks")
			.insert({
				owned_by_user_id: accessGroupId ? null : userId,
				access_group_id: accessGroupId,
				document_id: documentData.id,
				folder_id,
				content,
				page: pageNumber,
				chunk_index,
				chunk_mistral_embedding,
			})
			.select()
			.single();

	expect(documentChunksInsertError).toBeNull();

	if (documentChunksInsertError !== null) {
		throw documentChunksInsertError;
	}

	return chunkData.id;
}

export async function uploadFileViaFileChooser({
	fileName,
	filePath,
	page,
	browserName,
	uploadButtonName,
}: {
	fileName: string;
	page: Page;
	filePath: string;
	browserName: string;
	uploadButtonName: string;
}) {
	await page.goto("/");

	await page.waitForLoadState("networkidle");

	if (browserName === "firefox") {
		// Firefox: setup file chooser handler and use input element directly
		page.on("filechooser", async (fileChooser) => {
			// Dismiss any file chooser dialogs that might appear
			await fileChooser.setFiles([]);
		});

		const fileInput = page.locator('input[type="file"]').first();
		await fileInput.setInputFiles(filePath);
	} else {
		// Other browsers: use file chooser event
		const fileChooserPromise = page.waitForEvent("filechooser");
		await page.getByRole("button", { name: uploadButtonName }).click();
		const fileChooser = await fileChooserPromise;
		await fileChooser.setFiles(filePath);
	}

	await testWithDocuments
		.expect(
			page.locator("#desktop-documents-panel").getByText(fileName, {
				exact: true,
			}),
		)
		.toBeVisible();

	const response = await page.waitForResponse(
		(givenResponse) =>
			givenResponse.url().includes("/documents/process") &&
			givenResponse.request().method() === "POST",
		{
			timeout: 60_000,
		},
	);

	expect(response.status()).toBe(204);

	// Wait for the file to appear in the document list (scope to desktop panel)
	const uploadedFile = page
		.locator("#desktop-documents-panel")
		.getByRole("button", {
			name: `Dokumente-Icon ${fileName}`,
		});

	await testWithDocuments.expect(uploadedFile).toBeVisible();

	// Close the file upload dialog
	await page.getByRole("button", { name: "Ein blaues X-Icon" }).click();

	return uploadedFile;
}

export async function uploadMultipleFilesViaFileChooser({
	files,
	page,
	browserName,
	uploadButtonName,
}: {
	files: Array<{ name: string; path: string }>;
	page: Page;
	browserName: string;
	uploadButtonName: string;
}) {
	await page.goto("/");

	await page.waitForLoadState("networkidle");

	const filePaths = files.map((file) => file.path);

	if (browserName === "firefox") {
		// Firefox: setup file chooser handler and use input element directly
		page.on("filechooser", async (fileChooser) => {
			// Dismiss any file chooser dialogs that might appear
			await fileChooser.setFiles([]);
		});

		const fileInput = page.locator('input[type="file"]').first();
		await fileInput.setInputFiles(filePaths);
	} else {
		// Other browsers: use file chooser event
		const fileChooserPromise = page.waitForEvent("filechooser");
		await page.getByRole("button", { name: uploadButtonName }).click();
		const fileChooser = await fileChooserPromise;
		await fileChooser.setFiles(filePaths);
	}

	// Wait for all files to be visible in the upload dialog
	for (const file of files) {
		await testWithDocuments
			.expect(
				page.locator("#desktop-documents-panel").getByText(file.name, {
					exact: true,
				}),
			)
			.toBeVisible();
	}

	// Wait for all upload responses
	const uploadResponses = [];
	for (let i = 0; i < files.length; i++) {
		const response = await page.waitForResponse(
			(givenResponse) =>
				givenResponse.url().includes("/documents/process") &&
				givenResponse.request().method() === "POST",
			{
				timeout: 60_000,
			},
		);
		uploadResponses.push(response);
		expect(response.status()).toBe(204);
	}

	// Wait for all files to appear in the document list (scope to desktop panel)
	const uploadedFiles = [];
	for (const file of files) {
		const uploadedFile = page
			.locator("#desktop-documents-panel")
			.getByRole("button", {
				name: `Dokumente-Icon ${file.name}`,
			});
		await testWithDocuments.expect(uploadedFile).toBeVisible();
		uploadedFiles.push(uploadedFile);
	}

	// Close the file upload dialog
	await page.getByRole("button", { name: "Ein blaues X-Icon" }).click();

	return uploadedFiles;
}

export async function uploadFileViaDragAndDrop({
	page,
	filePath,
	fileName,
	fileType,
}: {
	page: Page;
	filePath: string;
	fileName: string;
	fileType: string;
}) {
	const buffer = readFileSync(filePath).toString("base64");

	const dataTransfer = await page.evaluateHandle(
		async ({ bufferData, localFileName, localFileType }) => {
			const givenDataTransfer = new DataTransfer();

			const blob = await fetch(bufferData).then((res) => res.blob());

			const file = new File([blob], localFileName, { type: localFileType });
			givenDataTransfer.items.add(file);
			return givenDataTransfer;
		},
		{
			bufferData: `data:application/octet-stream;base64,${buffer}`,
			localFileName: fileName,
			localFileType: fileType,
		},
	);

	const dropZone = page.getByText(
		"Dateien ablegen, um sie hochzuladen inMeine Dateien",
	);

	await dropZone.dispatchEvent("dragenter", { dataTransfer });
	await dropZone.dispatchEvent("dragover", { dataTransfer });
	await dropZone.dispatchEvent("drop", { dataTransfer });

	const response = await page.waitForResponse(
		(givenResponse) =>
			givenResponse.url().includes("/documents/process") &&
			givenResponse.request().method() === "POST",
		{
			timeout: 60_000,
		},
	);

	expect(response.status()).toBe(204);

	// Wait for the file to appear in the document list (scope to desktop panel)
	const uploadedFile = page
		.locator("#desktop-documents-panel")
		.getByRole("button", {
			name: `Dokumente-Icon ${fileName}`,
		});

	await testWithDocuments.expect(uploadedFile).toBeVisible();

	// Close the file upload dialog
	await page.getByRole("button", { name: "Ein blaues X-Icon" }).click();
}

export async function deleteFileViaUI({
	page,
	fileName,
}: {
	page: Page;
	fileName: string;
}) {
	// Enter multi-select mode (checkboxes for delete appear), skip if already in multi-select
	const enterMultiSelectButton = page.getByRole("button", {
		name: "Checkbox-Icon (ausgewählt) Löschen",
	});
	if (await enterMultiSelectButton.isVisible()) {
		await enterMultiSelectButton.click();
	}

	// Ensure the checkbox from the uploaded file is present (scope to desktop panel)
	const checkbox = page
		.locator("#desktop-documents-panel")
		.getByRole("listitem")
		.filter({ hasText: fileName })
		.locator("label")
		.first();

	await expect(checkbox).toBeVisible();

	// Delete the file via the UI
	await checkbox.click();

	await page
		.getByRole("button", { name: "Dialog öffnen, um Elemente zu löschen" })
		.click();

	await page
		.getByRole("dialog")
		.getByRole("button", { name: "Löschen" })
		.click();

	const deletedDocumentLocator = page
		.locator("#desktop-documents-panel")
		.getByRole("button", {
			name: `Dokumente-Icon ${fileName}`,
		});

	await expect(deletedDocumentLocator).not.toBeVisible();
}

async function cleanup(userId: string) {
	// Delete hidden default documents FIRST (before deleting the documents they reference)
	const { error: deleteHiddenDefaultsError } = await supabaseAdminClient
		.from("user_hidden_default_documents")
		.delete()
		.eq("user_id", userId);
	expect(deleteHiddenDefaultsError).toBeNull();

	// Clean up personal documents owned by this user
	const { error: deleteDocumentsError } = await supabaseAdminClient
		.from("documents")
		.delete()
		.eq("owned_by_user_id", userId);
	expect(deleteDocumentsError).toBeNull();

	// Clean up default documents uploaded by this user (for access groups)
	const { data: accessGroupDocuments, error: getAccessGroupDocsError } =
		await supabaseAdminClient
			.from("documents")
			.select("id, source_url")
			.eq("uploaded_by_user_id", userId)
			.eq("source_type", "default_document");
	expect(getAccessGroupDocsError).toBeNull();

	if (accessGroupDocuments && accessGroupDocuments.length > 0) {
		const accessGroupDocIds = accessGroupDocuments.map((doc) => doc.id);

		// Delete related chunks and summaries
		const { error: deleteAccessGroupChunksError } = await supabaseAdminClient
			.from("document_chunks")
			.delete()
			.in("document_id", accessGroupDocIds);
		expect(deleteAccessGroupChunksError).toBeNull();

		const { error: deleteAccessGroupSummariesError } = await supabaseAdminClient
			.from("document_summaries")
			.delete()
			.in("document_id", accessGroupDocIds);
		expect(deleteAccessGroupSummariesError).toBeNull();

		// Delete the documents themselves
		const { error: deleteAccessGroupDocsError } = await supabaseAdminClient
			.from("documents")
			.delete()
			.in("id", accessGroupDocIds);
		expect(deleteAccessGroupDocsError).toBeNull();

		// Delete files from storage
		for (const doc of accessGroupDocuments) {
			if (doc.source_url) {
				const { error: deleteStorageError } = await supabaseAdminClient.storage
					.from("public_documents")
					.remove([doc.source_url]);
				// RLS may prevent storage deletion even with admin client
				if (deleteStorageError) {
					console.warn(
						"Could not delete file from storage:",
						doc.source_url,
						deleteStorageError.message,
					);
				}
			}
		}
	}

	const { error: deleteFoldersError } = await supabaseAdminClient
		.from("document_folders")
		.delete()
		.eq("user_id", userId);
	expect(deleteFoldersError).toBeNull();

	const { error: deleteDocumentChunksError } = await supabaseAdminClient
		.from("document_chunks")
		.delete()
		.eq("owned_by_user_id", userId);
	expect(deleteDocumentChunksError).toBeNull();

	const { error: deleteDocumentSummariesError } = await supabaseAdminClient
		.from("document_summaries")
		.delete()
		.eq("owned_by_user_id", userId);
	expect(deleteDocumentSummariesError).toBeNull();

	const { data: personalDocumentsData, error: personalDocumentsError } =
		await supabaseAdminClient.storage.from("documents").list(`${userId}`);

	expect(personalDocumentsError).toBeNull();

	if (personalDocumentsError !== null) {
		throw personalDocumentsError;
	}

	const personalDocumentsToRemove = personalDocumentsData.map(
		(file) => `${userId}/${file.name}`,
	);

	if (personalDocumentsToRemove.length > 0) {
		const { error: deletePersonalDocumentsError } =
			await supabaseAdminClient.storage
				.from("documents")
				.remove(personalDocumentsToRemove);
		// RLS may prevent storage deletion even with admin client
		if (deletePersonalDocumentsError) {
			console.warn(
				"Could not delete personal documents from storage:",
				deletePersonalDocumentsError.message,
			);
		}
	}

	const { data: publicDocumentsData, error: publicDocumentsError } =
		await supabaseAdminClient.storage
			.from("public_documents")
			.list(`${userId}`);

	expect(publicDocumentsError).toBeNull();

	if (publicDocumentsError !== null) {
		throw publicDocumentsError;
	}

	const publicDocumentsToRemove = publicDocumentsData.map(
		(file) => `${userId}/${file.name}`,
	);

	if (publicDocumentsToRemove.length > 0) {
		const { error: deletePublicDocumentsError } =
			await supabaseAdminClient.storage
				.from("public_documents")
				.remove(publicDocumentsToRemove);

		// RLS may prevent storage deletion even with admin client
		if (deletePublicDocumentsError) {
			console.warn(
				"Could not delete public documents from storage:",
				deletePublicDocumentsError.message,
			);
		}
	}
}
