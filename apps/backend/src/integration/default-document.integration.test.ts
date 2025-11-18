import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "../config";
import { supabase as supabaseAdminClient } from "../supabase";
import { DatabaseService } from "../services/database-service";
import { GenerationService } from "../services/generation-service";
import { EmbeddingService } from "../services/embedding-service";
import type { Document, LLMIdentifier } from "../types/common";

const DEFAULT_DOCUMENT_FILE_NAME = "BaerGPT-Handbuch.pdf";
const DEFAULT_DOCUMENT_SOURCE_URL = DEFAULT_DOCUMENT_FILE_NAME; // Store at root of bucket
const DEFAULT_DOCUMENT_SOURCE_TYPE = "default_document";
const PUBLIC_DOCUMENTS_BUCKET = "public_documents";

type ExistingDocument = {
	id: number;
	source_url: string;
	processing_finished_at: string | null;
	file_name: string | null;
};

describe("Default Document Integration Tests", () => {
	let accessGroupId: string;

	const dbService = new DatabaseService();
	const generationService = new GenerationService();
	const embeddingService = new EmbeddingService();

	beforeAll(async () => {
		// Ensure default access group exists
		const { data: accessGroup, error } = await supabaseAdminClient
			.from("access_groups")
			.select("id")
			.eq("name", "Alle")
			.single();

		if (error || !accessGroup) {
			throw new Error(
				"Default access group 'Alle' must exist for tests to run",
			);
		}

		accessGroupId = accessGroup.id;
	});

	afterEach(async () => {
		// Clean up after each test
		await cleanupDefaultDocument();
	});

	afterAll(async () => {
		// Final cleanup
		await cleanupDefaultDocument();
	});

	async function checkExistingDocuments(fileName: string): Promise<{
		existingDocuments: ExistingDocument[] | null;
		processedDocument: ExistingDocument | null;
		existingDocument: ExistingDocument | null;
	}> {
		const sourceUrl = fileName; // Store at root of bucket
		const { data: existingDocuments, error: checkError } =
			await supabaseAdminClient
				.from("documents")
				.select("id, source_url, processing_finished_at, file_name")
				.eq("source_url", sourceUrl)
				.eq("source_type", DEFAULT_DOCUMENT_SOURCE_TYPE);

		if (checkError) {
			throw new Error(
				`Error checking for existing document: ${checkError.message}`,
			);
		}

		const processedDocument = existingDocuments?.find(
			(doc) => !!doc.processing_finished_at,
		) as ExistingDocument | null;

		const existingDocument = (processedDocument ??
			existingDocuments?.[0] ??
			null) as ExistingDocument | null;

		return { existingDocuments, processedDocument, existingDocument };
	}

	async function cleanupDuplicates(
		existingDocuments: ExistingDocument[],
		existingDocument: ExistingDocument,
	): Promise<void> {
		const idsToDelete = existingDocuments
			.filter((doc) => doc.id !== existingDocument.id)
			.map((doc) => doc.id);
		if (idsToDelete.length > 0) {
			const { error: deleteError } = await supabaseAdminClient
				.from("documents")
				.delete()
				.in("id", idsToDelete);
			if (deleteError) {
				throw new Error(`Error cleaning up duplicates: ${deleteError.message}`);
			}
		}
	}

	function readFileFromDisk(
		fileName: string = DEFAULT_DOCUMENT_FILE_NAME,
	): Buffer {
		const filePath = resolve(
			process.cwd(),
			`./src/default_documents/${fileName}`,
		);
		try {
			return readFileSync(filePath);
		} catch (fileError) {
			throw new Error(
				`Error reading file at ${filePath}: ${
					fileError instanceof Error ? fileError.message : fileError
				}`,
			);
		}
	}

	async function uploadFileToStorage(
		file: File,
		fileName: string = DEFAULT_DOCUMENT_FILE_NAME,
	): Promise<void> {
		const sourceUrl = fileName; // Store at root of bucket
		const { error: uploadError } = await supabaseAdminClient.storage
			.from(PUBLIC_DOCUMENTS_BUCKET)
			.upload(sourceUrl, file, {
				upsert: true, // Replace if exists
			});

		if (uploadError) {
			throw new Error(
				`Error uploading file to storage: ${uploadError.message}`,
			);
		}
	}

	async function deleteUnprocessedRecord(
		existingDocument: ExistingDocument,
	): Promise<void> {
		const { error: deleteError } = await supabaseAdminClient
			.from("documents")
			.delete()
			.eq("id", existingDocument.id);
		if (deleteError) {
			throw new Error(
				`Error deleting unprocessed record: ${deleteError.message}`,
			);
		}
	}

	async function processDocument(
		file: File,
		fileName: string = DEFAULT_DOCUMENT_FILE_NAME,
	): Promise<void> {
		const sourceUrl = fileName; // Store at root of bucket
		const documentToProcess: Document = {
			id: 0, // Will be set by logAndExtractDocument
			source_url: sourceUrl,
			source_type: DEFAULT_DOCUMENT_SOURCE_TYPE,
			file_size: file.size,
			created_at: new Date().toISOString(),
			access_group_id: accessGroupId,
		};

		const llmIdentifier = config.defaultModelIdentifier as LLMIdentifier;
		const extractionResult =
			await dbService.logAndExtractDocument(documentToProcess);
		const extractedDocument = extractionResult.document;

		const parsedPages = extractionResult.parsedPages;
		await Promise.all([
			generationService.summarize(
				parsedPages,
				llmIdentifier,
				extractedDocument,
			),
			embeddingService.batchEmbed(parsedPages, extractedDocument, {
				chunkingTechnique: "markdown",
			}),
		]);

		await dbService.finishProcessing(extractedDocument);
	}

	async function uploadDefaultDocument(
		fileName: string = DEFAULT_DOCUMENT_FILE_NAME,
	): Promise<void> {
		const { existingDocuments, processedDocument, existingDocument } =
			await checkExistingDocuments(fileName);

		// If document is already fully processed, skip everything
		if (processedDocument) {
			return;
		}

		// Clean up duplicates if any (keep the one we'll use)
		if (existingDocuments && existingDocuments.length > 1 && existingDocument) {
			await cleanupDuplicates(existingDocuments, existingDocument);
		}

		// Read file from disk
		const fileBuffer = readFileFromDisk(fileName);
		const file = new File([new Uint8Array(fileBuffer)], fileName, {
			type: "application/pdf",
		});

		// Upload to storage
		await uploadFileToStorage(file, fileName);

		// If an unprocessed record exists, delete it first
		if (existingDocument && !existingDocument.processing_finished_at) {
			await deleteUnprocessedRecord(existingDocument);
		}

		// Process the document
		await processDocument(file, fileName);
	}

	async function cleanupDefaultDocument(
		fileName: string = DEFAULT_DOCUMENT_FILE_NAME,
	): Promise<void> {
		const sourceUrl = fileName; // Store at root of bucket
		// Delete document record
		const { error: deleteDocError } = await supabaseAdminClient
			.from("documents")
			.delete()
			.eq("source_url", sourceUrl)
			.eq("source_type", DEFAULT_DOCUMENT_SOURCE_TYPE);

		if (deleteDocError) {
			// Ignore errors if document doesn't exist
			return;
		}

		// Delete from storage
		const { error: deleteStorageError } = await supabaseAdminClient.storage
			.from(PUBLIC_DOCUMENTS_BUCKET)
			.remove([sourceUrl]);

		if (deleteStorageError) {
			// Storage file might not exist, which is okay
			if (!deleteStorageError.message?.includes("not found")) {
				// Ignore storage deletion errors in cleanup
				return;
			}
		}
	}

	it("should upload default document to storage", async () => {
		const fileBuffer = readFileFromDisk();
		const file = new File(
			[new Uint8Array(fileBuffer)],
			DEFAULT_DOCUMENT_FILE_NAME,
			{
				type: "application/pdf",
			},
		);

		await uploadFileToStorage(file, DEFAULT_DOCUMENT_FILE_NAME);

		// Verify file exists in storage
		const { data: fileData, error: listError } =
			await supabaseAdminClient.storage.from(PUBLIC_DOCUMENTS_BUCKET).list();

		expect(listError).toBeNull();
		expect(fileData).toBeDefined();
		expect(fileData?.some((f) => f.name === DEFAULT_DOCUMENT_SOURCE_URL)).toBe(
			true,
		);
	}, 60_000);

	it("should upload and process default document with correct properties", async () => {
		await uploadDefaultDocument();

		// Verify document was created in database
		const { data: documents, error: docError } = await supabaseAdminClient
			.from("documents")
			.select("*")
			.eq("source_url", DEFAULT_DOCUMENT_SOURCE_URL)
			.eq("source_type", DEFAULT_DOCUMENT_SOURCE_TYPE)
			.single();

		expect(docError).toBeNull();
		expect(documents).toBeDefined();
		expect(documents?.source_type).toBe(DEFAULT_DOCUMENT_SOURCE_TYPE);
		expect(documents?.source_url).toBe(DEFAULT_DOCUMENT_SOURCE_URL);
		expect(documents?.file_name).toBe(DEFAULT_DOCUMENT_FILE_NAME);
		expect(documents?.processing_finished_at).not.toBeNull();

		// Verify it's associated with the default access group
		expect(documents?.access_group_id).toBe(accessGroupId);
		expect(documents?.owned_by_user_id).toBeNull(); // Default documents are not owned by users
	}, 400_000);

	it("should skip upload if document is already processed", async () => {
		// First upload
		await uploadDefaultDocument();

		// Get the document ID from first upload
		const { data: firstDoc } = await supabaseAdminClient
			.from("documents")
			.select("id, processing_finished_at")
			.eq("source_url", DEFAULT_DOCUMENT_SOURCE_URL)
			.eq("source_type", DEFAULT_DOCUMENT_SOURCE_TYPE)
			.single();

		expect(firstDoc).toBeDefined();
		expect(firstDoc?.processing_finished_at).not.toBeNull();
		const firstDocId = firstDoc?.id;

		// Try to upload again
		await uploadDefaultDocument();

		// Verify same document still exists (not duplicated)
		const { data: documents } = await supabaseAdminClient
			.from("documents")
			.select("id")
			.eq("source_url", DEFAULT_DOCUMENT_SOURCE_URL)
			.eq("source_type", DEFAULT_DOCUMENT_SOURCE_TYPE);

		expect(documents).toBeDefined();
		expect(documents?.length).toBe(1);
		expect(documents?.[0]?.id).toBe(firstDocId);
	}, 400_000);

	it("should clean up duplicate documents", async () => {
		// First, ensure the file is uploaded to storage
		const fileBuffer = readFileFromDisk();
		const file = new File(
			[new Uint8Array(fileBuffer)],
			DEFAULT_DOCUMENT_FILE_NAME,
			{
				type: "application/pdf",
			},
		);
		await uploadFileToStorage(file, DEFAULT_DOCUMENT_FILE_NAME);

		// Manually create duplicate documents
		const { data: duplicate1 } = await supabaseAdminClient
			.from("documents")
			.insert({
				source_url: DEFAULT_DOCUMENT_SOURCE_URL,
				source_type: DEFAULT_DOCUMENT_SOURCE_TYPE,
				file_name: DEFAULT_DOCUMENT_FILE_NAME,
				access_group_id: accessGroupId,
				processing_finished_at: null,
			})
			.select()
			.single();

		const { data: duplicate2 } = await supabaseAdminClient
			.from("documents")
			.insert({
				source_url: DEFAULT_DOCUMENT_SOURCE_URL,
				source_type: DEFAULT_DOCUMENT_SOURCE_TYPE,
				file_name: DEFAULT_DOCUMENT_FILE_NAME,
				access_group_id: accessGroupId,
				processing_finished_at: null,
			})
			.select()
			.single();

		expect(duplicate1).toBeDefined();
		expect(duplicate2).toBeDefined();

		// Upload should clean up duplicates
		await uploadDefaultDocument();

		// Verify only one document remains
		const { data: documents } = await supabaseAdminClient
			.from("documents")
			.select("id")
			.eq("source_url", DEFAULT_DOCUMENT_SOURCE_URL)
			.eq("source_type", DEFAULT_DOCUMENT_SOURCE_TYPE);

		expect(documents).toBeDefined();
		expect(documents?.length).toBe(1);
	}, 400_000);

	it("should delete unprocessed record before processing", async () => {
		// First, ensure the file is uploaded to storage
		const fileBuffer = readFileFromDisk();
		const file = new File(
			[new Uint8Array(fileBuffer)],
			DEFAULT_DOCUMENT_FILE_NAME,
			{
				type: "application/pdf",
			},
		);
		await uploadFileToStorage(file, DEFAULT_DOCUMENT_FILE_NAME);

		// Create an unprocessed document record
		const { data: unprocessedDoc } = await supabaseAdminClient
			.from("documents")
			.insert({
				source_url: DEFAULT_DOCUMENT_SOURCE_URL,
				source_type: DEFAULT_DOCUMENT_SOURCE_TYPE,
				file_name: DEFAULT_DOCUMENT_FILE_NAME,
				access_group_id: accessGroupId,
				processing_finished_at: null,
			})
			.select()
			.single();

		expect(unprocessedDoc).toBeDefined();
		const unprocessedDocId = unprocessedDoc?.id;
		if (!unprocessedDocId) {
			throw new Error("unprocessedDocId is undefined");
		}

		// Upload should delete unprocessed record and create a new processed one
		await uploadDefaultDocument();

		// Verify the old unprocessed record is gone
		const { data: oldDoc } = await supabaseAdminClient
			.from("documents")
			.select("id")
			.eq("id", unprocessedDocId)
			.single();

		expect(oldDoc).toBeNull();

		// Verify a new processed document exists
		const { data: newDoc } = await supabaseAdminClient
			.from("documents")
			.select("id, processing_finished_at")
			.eq("source_url", DEFAULT_DOCUMENT_SOURCE_URL)
			.eq("source_type", DEFAULT_DOCUMENT_SOURCE_TYPE)
			.single();

		expect(newDoc).toBeDefined();
		expect(newDoc?.processing_finished_at).not.toBeNull();
		expect(newDoc?.id).not.toBe(unprocessedDocId);
	}, 400_000);

	it("should create document summary and chunks after processing", async () => {
		await uploadDefaultDocument();

		// Get the document
		const { data: document } = await supabaseAdminClient
			.from("documents")
			.select("id")
			.eq("source_url", DEFAULT_DOCUMENT_SOURCE_URL)
			.eq("source_type", DEFAULT_DOCUMENT_SOURCE_TYPE)
			.single();

		expect(document).toBeDefined();
		const documentId = document?.id;
		if (!documentId) {
			throw new Error("documentId is undefined");
		}

		// Verify summary was created
		const { data: summary, error: summaryError } = await supabaseAdminClient
			.from("document_summaries")
			.select("*")
			.eq("document_id", documentId)
			.single();

		expect(summaryError).toBeNull();
		expect(summary).toBeDefined();
		expect(summary?.summary).toBeDefined();
		expect(summary?.short_summary).toBeDefined();

		// Verify chunks were created
		const { data: chunks, error: chunksError } = await supabaseAdminClient
			.from("document_chunks")
			.select("*")
			.eq("document_id", documentId);

		expect(chunksError).toBeNull();
		expect(chunks).toBeDefined();
		expect(chunks?.length).toBeGreaterThan(0);
	}, 400_000);
});
