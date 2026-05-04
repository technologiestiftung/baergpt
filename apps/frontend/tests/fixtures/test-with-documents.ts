import { supabaseAdminClient } from "../supabase.ts";
import { testWithMockedLlm } from "./test-with-mocked-llm.ts";
import { expect, Page } from "@playwright/test";
import { createClient, Session } from "@supabase/supabase-js";
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
	seedDefaultDocumentName,
} from "../constants.ts";
import { readFileSync } from "node:fs";

export const testWithDocuments = testWithMockedLlm.extend<{
	documentChunkId: number;
}>({
	documentChunkId: [
		async ({ account, session }, use) => {
			/**
			 * This happens before each test that uses this fixture.
			 */

			await uploadDefaultDocumentIfNecessary({ account, session });

			// upload a personal document for the user
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

async function uploadDefaultDocumentIfNecessary(args: {
	account: { email: string; password: string; id: string };
	session: Session;
}) {
	const { count: count1, error } = await supabaseAdminClient
		.from("documents")
		.select("id", { count: "exact", head: true })
		.eq("source_type", "default_document")
		.eq("file_name", seedDefaultDocumentName);

	expect(error).toBeNull();

	if (count1 && count1 > 0) {
		// Default document already exists, no need to upload again
		return;
	}

	const { account, session } = args;

	// Get the "Alle" access group ID for creating default documents
	const { data: accessGroup, error: accessGroupError } =
		await supabaseAdminClient
			.from("access_groups")
			.select("id")
			.eq("name", "Alle")
			.single();

	expect(accessGroupError).toBeNull();

	if (!accessGroup) {
		throw new Error("Default access group 'Alle' not found");
	}

	// Create a mock default document
	await mockDocumentUpload({
		userId: account.id,
		accessToken: session.access_token,
		accessGroupId: accessGroup.id,
		fileName: seedDefaultDocumentName,
		filePath: defaultDocumentPath,
		sourceType: "default_document" as const,
		bucketName: "public_documents",
	});

	const { count: count2, error: defaultDocumentsError } =
		await supabaseAdminClient
			.from("documents")
			.select("source_type,file_name", { count: "exact", head: true })
			.eq("source_type", "default_document")
			.eq("file_name", seedDefaultDocumentName);

	expect(defaultDocumentsError).toBeNull();
	expect(count2).toBe(1);
}

/**
 * Mocks a full document upload:
 * - uploads file to storage
 * - inserts mock values into the db tables
 */
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

	return mockDocumentProcessing({
		userId,
		sourceUrl: source_url,
		accessGroupId,
		fileName,
		sourceType,
	});
}

/**
 * Mocks a partial document upload:
 * only inserts mock values into the db tables
 * for a given file that already exists in storage
 */
export async function mockDocumentProcessing({
	userId,
	sourceUrl,
	accessGroupId,
	fileName,
	sourceType,
}: {
	userId: string;
	sourceUrl: string;
	accessGroupId: string | null;
	fileName: string;
	sourceType: "public_document" | "personal_document" | "default_document";
}) {
	const { data: documentData, error: documentsInsertError } =
		await supabaseAdminClient
			.from("documents")
			.insert({
				owned_by_user_id: accessGroupId ? null : userId,
				access_group_id: accessGroupId,
				uploaded_by_user_id: accessGroupId ? userId : null,
				source_type: sourceType,
				source_url: sourceUrl,
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

/**
 * Makes a real file upload of a single file via the file chooser and waits for
 * the file to be fully processed and appear in the document list.
 */
export async function uploadFileViaFileChooserAndWait({
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

/**
 * Makes a real file upload of a single file via the file chooser without waiting for
 * the file to be fully processed and appear in the document list.
 * It's used for testing scenarios where we want to check intermediate states
 * during upload/processing, or when we want to trigger an upload without
 * needing it to complete.
 */
export async function attemptFileUploadViaFileChooser({
	filePath,
	page,
	browserName,
	uploadButtonName,
}: {
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
}

/**
 * Makes a real file upload of multiple files via the file chooser and waits for
 * the files to be fully processed and appear in the document list.
 */
export async function uploadMultipleFilesViaFileChooserAndWait({
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

/**
 * Makes a real file upload of multiple files via the file chooser without waiting for
 * the files to be fully processed and appear in the document list.
 * It's used for testing scenarios where we want to check intermediate states
 * during upload/processing, or when we want to trigger an upload without
 * needing it to complete.
 */
export async function attemptMultipleFilesViaFileChooser({
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
}

/**
 * Makes a real file upload of multiple files via drag and drop and waits for
 * the files to be fully processed and appear in the document list.
 */
export async function uploadFileViaDragAndDropAndWait({
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

/**
 * Deletes a file via the UI
 */
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

/**
 * Deletes all storage files, documents and related
 * entries from the database for a given user.
 */
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
