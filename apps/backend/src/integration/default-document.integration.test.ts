import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@repo/db-schema";
import { resolve } from "node:path";
import { config } from "../config";
import { GenerationService } from "../services/generation-service";
import { EmbeddingService } from "../services/embedding-service";
import type { Document } from "../types/common";
import { PrivilegedDbService } from "../services/db-service/privileged-db-service";
import { serviceRoleDbClient } from "../supabase";
import {
	defaultDocumentsBucket as PUBLIC_DOCUMENTS_BUCKET,
	defaultDocumentSourceType as DEFAULT_DOCUMENT_SOURCE_TYPE,
	replaceDefaultDocument,
} from "../../supabase/scripts/replace-default-documents";
import { defaultDocumentPath } from "./fixtures/constants";

const DEFAULT_DOCUMENT_FILE_NAME = "BaerGPT-Handbuch.pdf";

const supabaseAnonClient = createClient<Database>(
	config.supabaseUrl,
	config.supabaseAnonKey,
);

// Mocked processing outputs so the test exercises real storage + DB writes
// without hitting the (flaky) API OCR / LLM / embedding APIs. The chunk
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

const readDefaultDocumentFile = () => {
	const filePath = resolve(
		process.cwd(),
		`./src/default_documents/${DEFAULT_DOCUMENT_FILE_NAME}`,
	);
	const fileBuffer = readFileSync(filePath);

	return new File([new Uint8Array(fileBuffer)], DEFAULT_DOCUMENT_FILE_NAME, {
		type: "application/pdf",
	});
};

// The upload script stores default documents under a random UUID path, so
// cleanup has to go by file_name + access group, not by a predictable path.
const cleanupDefaultDocuments = async (
	accessGroupId: string,
	uploadedSourceUrl?: string,
) => {
	try {
		const { data: documents } = await serviceRoleDbClient
			.from("documents")
			.select("id, source_url")
			.eq("source_type", DEFAULT_DOCUMENT_SOURCE_TYPE)
			.eq("file_name", DEFAULT_DOCUMENT_FILE_NAME)
			.eq("access_group_id", accessGroupId);

		const documentIds = documents?.map((doc) => doc.id) ?? [];

		const sourceUrls = [
			...new Set(
				[
					...(documents?.map((doc) => doc.source_url) ?? []),
					uploadedSourceUrl,
				].filter((url): url is string => Boolean(url)),
			),
		];

		if (documentIds.length > 0) {
			// Delete related document_chunks
			await serviceRoleDbClient
				.from("document_chunks")
				.delete()
				.in("document_id", documentIds);

			// Delete related document_summaries
			await serviceRoleDbClient
				.from("document_summaries")
				.delete()
				.in("document_id", documentIds);

			// Delete document records
			await serviceRoleDbClient
				.from("documents")
				.delete()
				.in("id", documentIds);
		}

		// Delete from storage
		if (sourceUrls.length > 0) {
			const { error: removeError } = await serviceRoleDbClient.storage
				.from(PUBLIC_DOCUMENTS_BUCKET)
				.remove(sourceUrls);

			if (removeError && !removeError.message?.includes("not found")) {
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
	let sourceUrl: string;

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
		await cleanupDefaultDocuments(accessGroupId, sourceUrl);
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

		const file = readDefaultDocumentFile();

		sourceUrl = `${accessGroupId}/${randomUUID()}.pdf`;

		// Upload file to storage
		const { error: uploadError } = await serviceRoleDbClient.storage
			.from(PUBLIC_DOCUMENTS_BUCKET)
			.upload(sourceUrl, file);

		if (uploadError) {
			throw new Error(
				`Error uploading file to storage: ${uploadError.message}`,
			);
		}

		const document: Document = {
			source_url: sourceUrl,
			source_type: DEFAULT_DOCUMENT_SOURCE_TYPE,
			file_name: DEFAULT_DOCUMENT_FILE_NAME,
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
		const storageObjectName = sourceUrl.split("/").pop();

		// Verify file exists in storage (list files in access group folder)
		const { data: fileData, error: listError } =
			await serviceRoleDbClient.storage
				.from(PUBLIC_DOCUMENTS_BUCKET)
				.list(accessGroupId);

		expect(listError).toBeNull();
		expect(fileData).toBeDefined();
		expect(fileData?.some((f) => f.name === storageObjectName)).toBe(true);

		// Verify file can be downloaded
		const { data: downloadedFile, error: downloadError } =
			await serviceRoleDbClient.storage
				.from(PUBLIC_DOCUMENTS_BUCKET)
				.download(sourceUrl);

		expect(downloadError).toBeNull();
		expect(downloadedFile).toBeDefined();
	}, 20_000);
});

describe("Default Document Replacement Integration Tests", () => {
	// Separate file name so this suite doesn't touch the real handbook rows
	const replacedFileName = `Replaced-Default-Document-${randomUUID()}.pdf`;

	const dbService = new PrivilegedDbService(serviceRoleDbClient);

	let accessGroupId: string;
	const userIds: string[] = [];
	const sourceUrls: string[] = [];

	const createUser = async () => {
		const { data, error } = await serviceRoleDbClient.auth.admin.createUser({
			email: `default-doc-${randomUUID()}@ts.berlin`,
			email_confirm: true,
		});
		if (error || !data.user) {
			throw new Error(`Failed to create user: ${error?.message}`);
		}
		userIds.push(data.user.id);
		return data.user.id;
	};

	const createDefaultDocument = async (
		checksum: string,
		{ isFinished }: { isFinished: boolean },
	) => {
		const sourceUrl = `${accessGroupId}/${randomUUID()}.pdf`;
		const { error: uploadError } = await serviceRoleDbClient.storage
			.from(PUBLIC_DOCUMENTS_BUCKET)
			.upload(
				sourceUrl,
				new File([new Uint8Array(readFileSync(defaultDocumentPath))], "x.pdf", {
					type: "application/pdf",
				}),
			);
		if (uploadError) {
			throw new Error(
				`Error uploading file to storage: ${uploadError.message}`,
			);
		}
		sourceUrls.push(sourceUrl);

		const documentId = await dbService.logProcessedDocument(
			{
				source_url: sourceUrl,
				source_type: DEFAULT_DOCUMENT_SOURCE_TYPE,
				file_name: replacedFileName,
				created_at: new Date().toISOString(),
				file_checksum: checksum,
				file_size: MOCK_EXTRACTION_RESULT.fileSize,
				num_pages: MOCK_EXTRACTION_RESULT.numPages,
				access_group_id: accessGroupId,
				...(isFinished ? {} : { processing_finished_at: null }),
			},
			MOCK_SUMMARY_DATA,
			MOCK_EMBEDDINGS as never,
		);

		return {
			id: documentId,
			source_url: sourceUrl,
			file_checksum: checksum,
			processing_finished_at: null,
		};
	};

	const hideDocument = async (userId: string, documentId: number) => {
		const { error } = await serviceRoleDbClient
			.from("user_hidden_default_documents")
			.insert({ user_id: userId, document_id: documentId });
		if (error) {
			throw new Error(`Failed to hide document: ${error.message}`);
		}
	};

	const createChatMessage = async (
		userId: string,
		allowedDocumentIds: number[],
	) => {
		const { data: chat, error: chatError } = await serviceRoleDbClient
			.from("chats")
			.insert({ user_id: userId, name: "Handbuch chat" })
			.select("id")
			.single();
		if (chatError) {
			throw new Error(`Failed to create chat: ${chatError.message}`);
		}

		const { data: message, error: messageError } = await serviceRoleDbClient
			.from("chat_messages")
			.insert({
				chat_id: chat.id,
				role: "user",
				type: "text",
				content: "Was steht im Handbuch?",
				allowed_document_ids: allowedDocumentIds,
			})
			.select("id")
			.single();
		if (messageError) {
			throw new Error(`Failed to create chat message: ${messageError.message}`);
		}
		return message.id;
	};

	beforeAll(async () => {
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
	});

	afterAll(async () => {
		for (const userId of userIds) {
			const { error } = await serviceRoleDbClient.auth.admin.deleteUser(userId);
			if (error) {
				console.error(`Failed to delete test user ${userId}:`, error);
			}
		}

		const { error: documentsError } = await serviceRoleDbClient
			.from("documents")
			.delete()
			.eq("file_name", replacedFileName);
		if (documentsError) {
			console.error("Failed to delete test documents:", documentsError);
		}

		if (sourceUrls.length > 0) {
			const { error: storageError } = await serviceRoleDbClient.storage
				.from(PUBLIC_DOCUMENTS_BUCKET)
				.remove(sourceUrls);
			if (storageError) {
				console.error("Failed to delete test files:", storageError);
			}
		}
	});

	it("should swap in the new version and carry over hidden state and chat references", async () => {
		const hidingUserId = await createUser();
		const otherUserId = await createUser();

		const previousVersions = [
			await createDefaultDocument("old-checksum-1", { isFinished: true }),
			await createDefaultDocument("old-checksum-2", { isFinished: true }),
		];
		const newVersion = await createDefaultDocument("new-checksum", {
			isFinished: false,
		});
		const previousIds = previousVersions.map(({ id }) => id);

		// Hidden in both, to check it is carried over only once
		await hideDocument(hidingUserId, previousIds[0]);
		await hideDocument(hidingUserId, previousIds[1]);

		const chatMessageId = await createChatMessage(otherUserId, previousIds);

		await replaceDefaultDocument(newVersion.id, previousVersions);

		const { data: hiddenRows } = await serviceRoleDbClient
			.from("user_hidden_default_documents")
			.select("user_id, document_id")
			.in("user_id", [hidingUserId, otherUserId]);
		expect(hiddenRows).toStrictEqual([
			{ user_id: hidingUserId, document_id: newVersion.id },
		]);

		const { data: chatMessage } = await serviceRoleDbClient
			.from("chat_messages")
			.select("allowed_document_ids")
			.eq("id", chatMessageId)
			.single();
		expect(chatMessage?.allowed_document_ids).toStrictEqual([newVersion.id]);

		const { data: remainingDocuments } = await serviceRoleDbClient
			.from("documents")
			.select("id, processing_finished_at")
			.eq("file_name", replacedFileName);
		expect(remainingDocuments).toHaveLength(1);
		expect(remainingDocuments?.[0].id).toBe(newVersion.id);
		expect(remainingDocuments?.[0].processing_finished_at).not.toBeNull();

		const { data: previousChunks } = await serviceRoleDbClient
			.from("document_chunks")
			.select("id")
			.in("document_id", previousIds);
		expect(previousChunks).toStrictEqual([]);

		const { data: previousSummaries } = await serviceRoleDbClient
			.from("document_summaries")
			.select("id")
			.in("document_id", previousIds);
		expect(previousSummaries).toStrictEqual([]);

		for (const { source_url } of previousVersions) {
			const { error: downloadError } = await serviceRoleDbClient.storage
				.from(PUBLIC_DOCUMENTS_BUCKET)
				.download(source_url);
			expect(downloadError).not.toBeNull();
		}

		const { error: newFileError } = await serviceRoleDbClient.storage
			.from(PUBLIC_DOCUMENTS_BUCKET)
			.download(newVersion.source_url);
		expect(newFileError).toBeNull();
	}, 20_000);

	it("should not be callable through the public API", async () => {
		const { error } = await supabaseAnonClient.rpc("replace_default_document", {
			p_new_document_id: 1,
			p_old_document_ids: [],
		});
		expect(error?.code).toBe("42501");
	});
});
