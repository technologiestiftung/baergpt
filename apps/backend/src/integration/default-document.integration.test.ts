import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "../config";
import { GenerationService } from "../services/generation-service";
import { EmbeddingService } from "../services/embedding-service";
import type { Document } from "../types/common";
import { PrivilegedDbService } from "../services/db-service/privileged-db-service";
import { serviceRoleDbClient } from "../supabase";

const DEFAULT_DOCUMENT_FILE_NAME = "BaerGPT-Handbuch.pdf";
const DEFAULT_DOCUMENT_SOURCE_TYPE = "default_document";
const PUBLIC_DOCUMENTS_BUCKET = "public_documents";

// Mocked processing outputs so the test exercises real storage + DB writes
// without hitting the (flaky) Mistral OCR / summary / embedding APIs. The chunk
// embedding must match the vector(1024) column, or the real insert fails.
const MOCK_EXTRACTION_RESULT = {
	parsedPages: [{ content: "page content", tokenCount: 10, pageNumber: 1 }],
	checksum: "test-checksum",
	fileSize: 1234,
	numPages: 1,
};
const MOCK_SUMMARY_DATA = {
	summary: "A summary",
	shortSummary: "Short",
	tags: ["tag"],
};
const MOCK_EMBEDDINGS = [
	{
		content: "chunk",
		embedding: new Array(config.mistralEmbeddingDimensions).fill(0),
		chunkIndex: 0,
		page: 1,
	},
];

const cleanupDefaultDocuments = async (accessGroupId: string) => {
	try {
		const sourceUrl = `${accessGroupId}/${DEFAULT_DOCUMENT_FILE_NAME}`;

		// Delete all default documents
		const { data: documents } = await serviceRoleDbClient
			.from("documents")
			.select("id")
			.eq("source_type", DEFAULT_DOCUMENT_SOURCE_TYPE)
			.eq("source_url", sourceUrl);

		const documentIds = documents?.map((doc) => doc.id) ?? [];

		// Delete related document_chunks
		if (documentIds.length > 0) {
			await serviceRoleDbClient
				.from("document_chunks")
				.delete()
				.in("document_id", documentIds);
		}

		// Delete related document_summaries
		if (documentIds.length > 0) {
			await serviceRoleDbClient
				.from("document_summaries")
				.delete()
				.in("document_id", documentIds);
		}

		// Delete document records
		await serviceRoleDbClient
			.from("documents")
			.delete()
			.eq("source_type", DEFAULT_DOCUMENT_SOURCE_TYPE)
			.eq("source_url", sourceUrl);

		// Delete from storage
		const { error: removeError } = await serviceRoleDbClient.storage
			.from(PUBLIC_DOCUMENTS_BUCKET)
			.remove([sourceUrl]);

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

	const dbService = new PrivilegedDbService(serviceRoleDbClient);
	const generationService = new GenerationService(dbService);
	const embeddingService = new EmbeddingService(dbService);

	beforeAll(async () => {
		// Ensure default access group exists
		const { data: accessGroup, error } = await serviceRoleDbClient
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
		await cleanupDefaultDocuments(accessGroupId);
	});

	afterAll(async () => {
		vi.restoreAllMocks();
		// Run cleanup after all tests
		await cleanupDefaultDocuments(accessGroupId);
	});

	it("should upload and process default document with correct properties", async () => {
		// Mock the expensive/flaky processing steps; logProcessedDocument still
		// runs for real so the DB assertions below (and in the next test) hold.
		vi.spyOn(
			PrivilegedDbService.prototype,
			"extractDocument",
		).mockResolvedValue(MOCK_EXTRACTION_RESULT as never);
		vi.spyOn(GenerationService.prototype, "summarize").mockResolvedValue(
			MOCK_SUMMARY_DATA as never,
		);
		vi.spyOn(EmbeddingService.prototype, "batchEmbed").mockResolvedValue(
			MOCK_EMBEDDINGS as never,
		);

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

		// Store in access group folder
		const sourceUrl = `${accessGroupId}/${DEFAULT_DOCUMENT_FILE_NAME}`;

		// Upload file to storage
		const { error: uploadError } = await serviceRoleDbClient.storage
			.from(PUBLIC_DOCUMENTS_BUCKET)
			.upload(sourceUrl, file, {
				upsert: true,
			});

		if (uploadError) {
			throw new Error(
				`Error uploading file to storage: ${uploadError.message}`,
			);
		}

		const document: Document = {
			source_url: sourceUrl,
			source_type: DEFAULT_DOCUMENT_SOURCE_TYPE,
			file_size: file.size,
			created_at: new Date().toISOString(),
			access_group_id: accessGroupId,
		};

		const extractionResult = await dbService.extractDocument(document, file);

		const documentForProcessing: Document = {
			...document,
			file_checksum: extractionResult.checksum,
			file_size: extractionResult.fileSize,
			num_pages: extractionResult.numPages,
		};

		const llmIdentifier = config.defaultDocumentProcessingModel;
		const [summaryData, embeddings] = await Promise.all([
			generationService.summarize(
				extractionResult.parsedPages,
				llmIdentifier,
				documentForProcessing,
			),
			embeddingService.batchEmbed(
				extractionResult.parsedPages,
				documentForProcessing,
				{
					chunkingTechnique: "markdown",
				},
			),
		]);

		await dbService.logProcessedDocument(
			documentForProcessing,
			summaryData,
			embeddings,
		);

		// Get the document ID from the database
		const { data: savedDocument } = await serviceRoleDbClient
			.from("documents")
			.select("id")
			.eq("source_url", sourceUrl)
			.eq("source_type", DEFAULT_DOCUMENT_SOURCE_TYPE)
			.single();

		if (!savedDocument) {
			throw new Error("Failed to get document ID from database");
		}
		documentId = savedDocument.id;

		// Verify document was created in database
		const { data: verifiedDoc, error: docError } = await serviceRoleDbClient
			.from("documents")
			.select("*")
			.eq("id", documentId)
			.single();

		expect(docError).toBeNull();
		expect(verifiedDoc).toBeDefined();
		expect(verifiedDoc?.source_type).toBe(DEFAULT_DOCUMENT_SOURCE_TYPE);
		expect(verifiedDoc?.source_url).toBe(sourceUrl);
		expect(verifiedDoc?.file_name).toBe(DEFAULT_DOCUMENT_FILE_NAME);
		expect(verifiedDoc?.processing_finished_at).not.toBeNull();

		// Verify it's associated with the default access group
		expect(verifiedDoc?.access_group_id).toBe(accessGroupId);
		expect(verifiedDoc?.owned_by_user_id).toBeNull(); // Default documents are not owned by users
	}, 20_000);

	it("should create document summary and chunks after processing", async () => {
		// Verify summary was created
		const { data: summary, error: summaryError } = await serviceRoleDbClient
			.from("document_summaries")
			.select("*")
			.eq("document_id", documentId)
			.single();

		expect(summaryError).toBeNull();
		expect(summary).toBeDefined();
		expect(summary?.summary).toBeDefined();
		expect(summary?.short_summary).toBeDefined();

		// Verify chunks were created
		const { data: chunks, error: chunksError } = await serviceRoleDbClient
			.from("document_chunks")
			.select("*")
			.eq("document_id", documentId);

		expect(chunksError).toBeNull();
		expect(chunks).toBeDefined();
		expect(chunks?.length).toBeGreaterThan(0);
	}, 20_000);

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

		// Store in access group folder
		const sourceUrl = `${accessGroupId}/${DEFAULT_DOCUMENT_FILE_NAME}`;

		// Upload file to storage
		const { error: uploadError } = await serviceRoleDbClient.storage
			.from(PUBLIC_DOCUMENTS_BUCKET)
			.upload(sourceUrl, file, {
				upsert: true,
			});

		if (uploadError) {
			throw new Error(
				`Error uploading file to storage: ${uploadError.message}`,
			);
		}

		// Verify file exists in storage (list files in access group folder)
		const { data: fileData, error: listError } =
			await serviceRoleDbClient.storage
				.from(PUBLIC_DOCUMENTS_BUCKET)
				.list(accessGroupId);

		expect(listError).toBeNull();
		expect(fileData).toBeDefined();
		expect(fileData?.some((f) => f.name === DEFAULT_DOCUMENT_FILE_NAME)).toBe(
			true,
		);

		// Verify file can be downloaded
		const { data: downloadedFile, error: downloadError } =
			await serviceRoleDbClient.storage
				.from(PUBLIC_DOCUMENTS_BUCKET)
				.download(sourceUrl);

		expect(downloadError).toBeNull();
		expect(downloadedFile).toBeDefined();
	}, 20_000);
});
