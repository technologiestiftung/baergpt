import { afterAll, beforeAll, describe, expect, it } from "vitest";
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

const cleanupDefaultDocuments = async () => {
	try {
		// Delete all default documents
		const { data: documents } = await supabaseAdminClient
			.from("documents")
			.select("id")
			.eq("source_type", DEFAULT_DOCUMENT_SOURCE_TYPE)
			.eq("source_url", DEFAULT_DOCUMENT_SOURCE_URL);

		const documentIds = documents?.map((doc) => doc.id) ?? [];

		// Delete related document_chunks
		if (documentIds.length > 0) {
			await supabaseAdminClient
				.from("document_chunks")
				.delete()
				.in("document_id", documentIds);
		}

		// Delete related document_summaries
		if (documentIds.length > 0) {
			await supabaseAdminClient
				.from("document_summaries")
				.delete()
				.in("document_id", documentIds);
		}

		// Delete document records
		await supabaseAdminClient
			.from("documents")
			.delete()
			.eq("source_type", DEFAULT_DOCUMENT_SOURCE_TYPE)
			.eq("source_url", DEFAULT_DOCUMENT_SOURCE_URL);

		// Delete from storage
		const { error: removeError } = await supabaseAdminClient.storage
			.from(PUBLIC_DOCUMENTS_BUCKET)
			.remove([DEFAULT_DOCUMENT_SOURCE_URL]);

		if (removeError) {
			if (!removeError.message?.includes("not found")) {
				console.error("Error removing storage file:", removeError);
			}
		}
	} catch (error) {
		console.error("Error during default documents cleanup:", error);
	}
};

describe("Default Document Integration Tests", () => {
	let accessGroupId: string;
	let documentId: number;

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

		// Run cleanup before all tests
		await cleanupDefaultDocuments();
	});

	afterAll(async () => {
		// Run cleanup after all tests
		await cleanupDefaultDocuments();
	});

	it("should upload and process default document with correct properties", async () => {
		// Read file from disk
		const filePath = resolve(
			process.cwd(),
			`./src/default_documents/${DEFAULT_DOCUMENT_FILE_NAME}`,
		);
		const fileBuffer = readFileSync(filePath);
		const file = new File(
			[new Uint8Array(fileBuffer)],
			DEFAULT_DOCUMENT_FILE_NAME,
			{
				type: "application/pdf",
			},
		);

		// Upload file to storage
		const { error: uploadError } = await supabaseAdminClient.storage
			.from(PUBLIC_DOCUMENTS_BUCKET)
			.upload(DEFAULT_DOCUMENT_SOURCE_URL, file, {
				upsert: true,
			});

		if (uploadError) {
			throw new Error(
				`Error uploading file to storage: ${uploadError.message}`,
			);
		}

		// Process the document
		const documentToProcess: Document = {
			id: 0, // Will be set by logAndExtractDocument
			source_url: DEFAULT_DOCUMENT_SOURCE_URL,
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
		documentId = extractedDocument.id;

		// Verify document was created in database
		const { data: document, error: docError } = await supabaseAdminClient
			.from("documents")
			.select("*")
			.eq("id", documentId)
			.single();

		expect(docError).toBeNull();
		expect(document).toBeDefined();
		expect(document?.source_type).toBe(DEFAULT_DOCUMENT_SOURCE_TYPE);
		expect(document?.source_url).toBe(DEFAULT_DOCUMENT_SOURCE_URL);
		expect(document?.file_name).toBe(DEFAULT_DOCUMENT_FILE_NAME);
		expect(document?.processing_finished_at).not.toBeNull();

		// Verify it's associated with the default access group
		expect(document?.access_group_id).toBe(accessGroupId);
		expect(document?.owned_by_user_id).toBeNull(); // Default documents are not owned by users
	}, 400_000);

	it("should create document summary and chunks after processing", async () => {
		// Read file from disk
		const filePath = resolve(
			process.cwd(),
			`./src/default_documents/${DEFAULT_DOCUMENT_FILE_NAME}`,
		);
		const fileBuffer = readFileSync(filePath);
		const file = new File(
			[new Uint8Array(fileBuffer)],
			DEFAULT_DOCUMENT_FILE_NAME,
			{
				type: "application/pdf",
			},
		);

		// Upload file to storage
		const { error: uploadError } = await supabaseAdminClient.storage
			.from(PUBLIC_DOCUMENTS_BUCKET)
			.upload(DEFAULT_DOCUMENT_SOURCE_URL, file, {
				upsert: true,
			});

		if (uploadError) {
			throw new Error(
				`Error uploading file to storage: ${uploadError.message}`,
			);
		}

		// Process the document
		const documentToProcess: Document = {
			id: 0, // Will be set by logAndExtractDocument
			source_url: DEFAULT_DOCUMENT_SOURCE_URL,
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
		const testDocumentId = extractedDocument.id;

		// Verify summary was created
		const { data: summary, error: summaryError } = await supabaseAdminClient
			.from("document_summaries")
			.select("*")
			.eq("document_id", testDocumentId)
			.single();

		expect(summaryError).toBeNull();
		expect(summary).toBeDefined();
		expect(summary?.summary).toBeDefined();
		expect(summary?.short_summary).toBeDefined();

		// Verify chunks were created
		const { data: chunks, error: chunksError } = await supabaseAdminClient
			.from("document_chunks")
			.select("*")
			.eq("document_id", testDocumentId);

		expect(chunksError).toBeNull();
		expect(chunks).toBeDefined();
		expect(chunks?.length).toBeGreaterThan(0);
	}, 400_000);

	it("should have file available in storage", async () => {
		// Read file from disk
		const filePath = resolve(
			process.cwd(),
			`./src/default_documents/${DEFAULT_DOCUMENT_FILE_NAME}`,
		);
		const fileBuffer = readFileSync(filePath);
		const file = new File(
			[new Uint8Array(fileBuffer)],
			DEFAULT_DOCUMENT_FILE_NAME,
			{
				type: "application/pdf",
			},
		);

		// Upload file to storage
		const { error: uploadError } = await supabaseAdminClient.storage
			.from(PUBLIC_DOCUMENTS_BUCKET)
			.upload(DEFAULT_DOCUMENT_SOURCE_URL, file, {
				upsert: true,
			});

		if (uploadError) {
			throw new Error(
				`Error uploading file to storage: ${uploadError.message}`,
			);
		}

		// Verify file exists in storage
		const { data: fileData, error: listError } =
			await supabaseAdminClient.storage.from(PUBLIC_DOCUMENTS_BUCKET).list();

		expect(listError).toBeNull();
		expect(fileData).toBeDefined();
		expect(fileData?.some((f) => f.name === DEFAULT_DOCUMENT_SOURCE_URL)).toBe(
			true,
		);

		// Verify file can be downloaded
		const { data: downloadedFile, error: downloadError } =
			await supabaseAdminClient.storage
				.from(PUBLIC_DOCUMENTS_BUCKET)
				.download(DEFAULT_DOCUMENT_SOURCE_URL);

		expect(downloadError).toBeNull();
		expect(downloadedFile).toBeDefined();
	}, 60_000);
});
