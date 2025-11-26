import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@repo/db-schema";
import { config } from "../config";
import { supabase as supabaseAdminClient } from "../supabase";
import { DatabaseService } from "../services/database-service";
import { EmbeddingService } from "../services/embedding-service";
import type { KnowledgeBaseDocument } from "../types/common";

const supabaseAnonClient = createClient<Database>(
	config.supabaseUrl,
	config.supabaseAnonKey,
);

const EMBEDDING_LENGTH = config.jinaEmbeddingDimensions;
const PUBLIC_BUCKET = "public_documents";
const SMALL_FILE_SIZE = 500;

const createDeterministicEmbedding = (length = EMBEDDING_LENGTH) =>
	Array.from({ length }, (_, i) => (i % 10) / 10);

describe("Base Knowledge Integration Tests", () => {
	const testUserEmail = "base-knowledge-test-user@local.berlin.de";
	const testUserPassword = "SecurePassword123!";

	let testUserId: string;
	let accessGroupId: string;
	let documentId: number;

	const dbService = new DatabaseService(supabaseAdminClient);
	const embeddingService = new EmbeddingService(dbService);

	beforeAll(async () => {
		// Create test user (idempotent: ignore already registered error)
		const { data: userData, error: signupError } =
			await supabaseAdminClient.auth.admin.createUser({
				email: testUserEmail,
				password: testUserPassword,
				email_confirm: true,
			});

		if (signupError && signupError.code !== "email_exists") {
			expect(signupError).toBeNull(); // force failure with diff if unexpected
		}
		if (userData && userData.user) {
			testUserId = userData.user.id;
		} else {
			// Fetch existing user id
			const { data: existingUsers, error: listErr } =
				await supabaseAdminClient.auth.admin.listUsers();
			expect(listErr).toBeNull();
			const existing = existingUsers.users.find(
				(u) => u.email === testUserEmail,
			);
			expect(existing).toBeDefined();
			testUserId = existing ? existing.id : "";
			expect(testUserId).not.toEqual("");
		}

		// Get default access group for base knowledge
		const { data: accessGroup, error: accessGroupError } =
			await supabaseAdminClient
				.from("access_groups")
				.select("id")
				.eq("name", "Alle")
				.single();
		if (accessGroup) {
			accessGroupId = accessGroup?.id;
		}
		expect(accessGroupError).toBeNull();

		// Create base knowledge document (owned_by_user_id is null, has access_group_id)
		const { data: document, error: documentError } = await supabaseAdminClient
			.from("documents")
			.insert({
				file_name: "test-base-knowledge-doc.pdf",
				source_type: "public_document",
				source_url: "test-base-knowledge-doc.pdf",
				file_checksum: "test-checksum",
				file_size: 1000,
				num_pages: 1,
				folder_id: null,
				owned_by_user_id: null,
				access_group_id: accessGroupId,
				processing_finished_at: new Date().toISOString(),
			})
			.select("id")
			.single();

		expect(documentError).toBeNull();
		expect(document).not.toBeNull();
		documentId = document ? document.id : 0;
		expect(documentId).toBeGreaterThan(0);

		// Create document summary
		const { error: summaryError } = await supabaseAdminClient
			.from("document_summaries")
			.insert({
				document_id: documentId,
				summary:
					"This is a test base knowledge document about artificial intelligence and machine learning.",
				short_summary: "A test document about AI and ML.",
				owned_by_user_id: null,
				folder_id: null,
				access_group_id: accessGroupId,
				tags: ["AI", "machine learning", "test"],
			});

		expect(summaryError).toBeNull();

		// Create a deterministic test embedding for the summary (stable across runs)
		const testEmbedding = createDeterministicEmbedding();

		// Update summary with embedding
		const { error: embeddingError } = await supabaseAdminClient
			.from("document_summaries")
			.update({
				summary_jina_embedding: JSON.stringify(testEmbedding),
			})
			.eq("document_id", documentId);

		expect(embeddingError).toBeNull();

		// Create document chunks
		const chunkEmbedding = createDeterministicEmbedding();

		const { error: chunkError } = await supabaseAdminClient
			.from("document_chunks")
			.insert({
				document_id: documentId,
				content:
					"Artificial intelligence and machine learning are transforming how we process information and make decisions.",
				page: 1,
				chunk_index: 0,
				owned_by_user_id: null,
				folder_id: null,
				access_group_id: accessGroupId,
				chunk_jina_embedding: JSON.stringify(chunkEmbedding),
			});

		expect(chunkError).toBeNull();
	});

	beforeEach(async () => {
		// Sign in test user
		const { data, error } = await supabaseAnonClient.auth.signInWithPassword({
			email: testUserEmail,
			password: testUserPassword,
		});

		expect(error).toBeNull();
		expect(data.session).toBeDefined();
	});

	afterEach(async () => {
		// Sign out
		const { error } = await supabaseAnonClient.auth.signOut();
		expect(error).toBeNull();
	});

	afterAll(async () => {
		// Delete document
		if (documentId && documentId > 0) {
			const { error: deleteDocError } = await supabaseAdminClient
				.from("documents")
				.delete()
				.eq("id", documentId);
			expect(deleteDocError).toBeNull();
		}

		// Delete access group membership
		if (testUserId) {
			const { error: deleteMembershipError } = await supabaseAdminClient
				.from("access_group_members")
				.delete()
				.eq("user_id", testUserId);
			expect(deleteMembershipError).toBeNull();
		}

		// Delete test user
		if (testUserId) {
			await supabaseAdminClient.auth.admin.deleteUser(testUserId);
		}
	});

	it("should retrieve base knowledge documents for user with access", async () => {
		const knowledgeBaseDocuments: KnowledgeBaseDocument[] =
			await dbService.getBaseKnowledgeDocuments(testUserId);

		expect(knowledgeBaseDocuments).toBeDefined();
		expect(Array.isArray(knowledgeBaseDocuments)).toBe(true);
		expect(knowledgeBaseDocuments.length).toBeGreaterThan(0);

		const testDocument = knowledgeBaseDocuments.find(
			(doc) => doc.id === documentId,
		);

		expect(testDocument).toBeDefined();
		expect(testDocument?.file_name).toBe("test-base-knowledge-doc.pdf");
		expect(testDocument?.short_summary).toBe(
			"A test document about AI and ML.",
		);
		expect(testDocument?.tags).toEqual(["AI", "machine learning", "test"]);
	});

	it("should perform hybrid search on base knowledge documents", async () => {
		// Mock embedding generation to avoid external API dependency in tests
		// override for test
		embeddingService.generateJinaEmbedding = async () => ({
			embedding: Array.from(
				{ length: EMBEDDING_LENGTH },
				(_, i) => (i % 10) / 10,
			),
			tokenUsage: 10,
		});
		// Get base knowledge documents
		const knowledgeBaseDocuments: KnowledgeBaseDocument[] =
			await dbService.getBaseKnowledgeDocuments(testUserId);

		expect(knowledgeBaseDocuments.length).toBeGreaterThan(0);

		// Test the search functionality directly
		const allowedDocumentIds = knowledgeBaseDocuments.map((doc) => doc.id);
		const allowedFolderIds = Array.from(
			new Set(knowledgeBaseDocuments.map((doc) => doc.folder_id)),
		);

		// Generate embedding for test query
		const testQuery = "artificial intelligence";
		const embeddingResponse = await embeddingService.generateJinaEmbedding(
			testQuery,
			"retrieval.query",
			testUserId,
		);

		expect(embeddingResponse.embedding).toBeDefined();

		// Perform hybrid search
		const chunkMatches = await dbService.performHybridChunkSearch(
			embeddingResponse.embedding,
			{
				queryText: testQuery,
				allowed_document_ids: allowedDocumentIds,
				allowed_folder_ids: allowedFolderIds,
			},
		);

		expect(chunkMatches).toBeDefined();
		expect(Array.isArray(chunkMatches)).toBe(true);

		if (chunkMatches.length > 0) {
			const firstMatch = chunkMatches[0];
			expect(firstMatch).toHaveProperty("chunk_id");
			expect(firstMatch).toHaveProperty("document_id");
			expect(firstMatch).toHaveProperty("chunk_content");
			expect(firstMatch.document_id).toBe(documentId);
		}
	});

	it("should not return results for documents user doesn't have access to", async () => {
		// Create another access group and document that the user doesn't have access to
		const { data: otherAccessGroup, error: accessGroupError } =
			await supabaseAdminClient
				.from("access_groups")
				.insert({ name: "Other Base Knowledge Group" })
				.select("id")
				.single();

		expect(accessGroupError).toBeNull();
		expect(otherAccessGroup).not.toBeNull();

		const { data: otherDocument, error: documentError } =
			await supabaseAdminClient
				.from("documents")
				.insert({
					file_name: "other-base-knowledge-doc.pdf",
					source_type: "public_document",
					source_url: "other-base-knowledge-doc.pdf",
					file_checksum: "other-checksum",
					file_size: 1000,
					num_pages: 1,
					folder_id: null,
					owned_by_user_id: null,
					access_group_id: otherAccessGroup ? otherAccessGroup.id : null,
					processing_finished_at: new Date().toISOString(),
				})
				.select("id")
				.single();

		expect(documentError).toBeNull();
		expect(otherDocument).not.toBeNull();

		try {
			// Get base knowledge documents for the test user
			const knowledgeBaseDocuments: KnowledgeBaseDocument[] =
				await dbService.getBaseKnowledgeDocuments(testUserId);

			// The user should only see their accessible document, not the other one
			const accessibleDocumentIds = knowledgeBaseDocuments.map((doc) => doc.id);
			expect(accessibleDocumentIds).toContain(documentId);
			if (otherDocument) {
				expect(accessibleDocumentIds).not.toContain(otherDocument.id);
			}
		} finally {
			// Clean up
			await supabaseAdminClient
				.from("documents")
				.delete()
				.eq("id", otherDocument ? otherDocument.id : -1);

			await supabaseAdminClient
				.from("access_groups")
				.delete()
				.eq(
					"id",
					otherAccessGroup
						? otherAccessGroup.id
						: "00000000-0000-0000-0000-000000000000",
				);
		}
	});

	it("should allow admin to delete public base knowledge documents", async () => {
		// First, make the test user an admin
		const { error: adminError } = await supabaseAdminClient
			.from("application_admins")
			.insert({
				user_id: testUserId,
			});

		expect(adminError).toBeNull();

		// Create a test file in the public_documents storage bucket
		const testFileName = "test-deletion-doc.pdf";
		const testFileContent = "This is a test PDF content for deletion test";
		const fileBlob = new Blob([testFileContent], { type: "application/pdf" });

		try {
			const { data: uploadData, error: uploadError } =
				await supabaseAdminClient.storage
					.from(PUBLIC_BUCKET)
					.upload(testFileName, fileBlob);

			expect(uploadError).toBeNull();
			expect(uploadData).not.toBeNull();

			// Verify the file exists in storage
			const { data: fileExists, error: listError } =
				await supabaseAdminClient.storage
					.from(PUBLIC_BUCKET)
					.list("", { search: testFileName });

			expect(listError).toBeNull();
			expect(fileExists).toBeDefined();
			expect(fileExists?.some((file) => file.name === testFileName)).toBe(true);

			// Create a test public document record that references the storage file
			const { data: testDoc, error: docError } = await supabaseAdminClient
				.from("documents")
				.insert({
					file_name: testFileName,
					source_type: "public_document",
					source_url: testFileName,
					file_checksum: "deletion-test-checksum",
					file_size: SMALL_FILE_SIZE,
					num_pages: 1,
					folder_id: null,
					owned_by_user_id: null,
					access_group_id: accessGroupId,
					processing_finished_at: new Date().toISOString(),
				})
				.select("id")
				.single();

			expect(docError).toBeNull();
			expect(testDoc).not.toBeNull();

			if (!testDoc) {
				throw new Error("Failed to create test document for deletion");
			}

			// Verify the document exists in database
			const { data: docExists, error: checkError } = await supabaseAdminClient
				.from("documents")
				.select("id")
				.eq("id", testDoc.id)
				.single();

			expect(checkError).toBeNull();
			expect(docExists).not.toBeNull();
			// Test admin deletion through the database function
			const { error: deleteError } = await supabaseAnonClient.rpc(
				"delete_document_and_update_count",
				{ document_id: testDoc.id },
			);
			expect(deleteError).toBeNull();

			// Verify the document was deleted from database
			const { data: deletedDoc, error: verifyError } = await supabaseAdminClient
				.from("documents")
				.select("id")
				.eq("id", testDoc.id)
				.maybeSingle();

			expect(verifyError).toBeNull();
			expect(deletedDoc).toBeNull();

			// verify the file was deleted from public_documents storage bucket
			const { data: fileAfterDeletion, error: listAfterError } =
				await supabaseAdminClient.storage
					.from(PUBLIC_BUCKET)
					.list("", { search: testFileName });

			expect(listAfterError).toBeNull();
			expect(fileAfterDeletion).toBeDefined();
			expect(
				fileAfterDeletion?.some((file) => file.name === testFileName),
			).toBe(false);
		} finally {
			// Clean up: remove admin status
			const { error: removeAdminError } = await supabaseAdminClient
				.from("application_admins")
				.delete()
				.eq("user_id", testUserId);

			expect(removeAdminError).toBeNull();

			// Clean up: ensure test file is removed from storage if it still exists
			await supabaseAdminClient.storage
				.from(PUBLIC_BUCKET)
				.remove([testFileName]);
		}
	});

	it("should prevent non-admin user from deleting public base knowledge documents", async () => {
		// Create a test public document
		const forbiddenTestFileName = "test-forbidden-deletion-doc.pdf";
		const { data: testDoc, error: docError } = await supabaseAdminClient
			.from("documents")
			.insert({
				file_name: forbiddenTestFileName,
				source_type: "public_document",
				source_url: forbiddenTestFileName,
				file_checksum: "forbidden-deletion-test-checksum",
				file_size: SMALL_FILE_SIZE,
				num_pages: 1,
				folder_id: null,
				owned_by_user_id: null,
				access_group_id: accessGroupId,
				processing_finished_at: new Date().toISOString(),
			})
			.select("id")
			.single();

		expect(docError).toBeNull();
		expect(testDoc).not.toBeNull();

		if (!testDoc) {
			throw new Error(
				"Failed to create test document for forbidden deletion test",
			);
		}

		try {
			// Ensure testUserId is NOT an admin
			const { data: adminCheck } = await supabaseAdminClient
				.from("application_admins")
				.select("user_id")
				.eq("user_id", testUserId)
				.maybeSingle();

			expect(adminCheck).toBeNull();

			// Attempt to delete the public document as a non-admin user should fail
			const { error: deleteError } = await supabaseAnonClient.rpc(
				"delete_document_and_update_count",
				{ document_id: testDoc.id },
			);
			expect(deleteError).not.toBeNull();
			expect(deleteError?.message).toContain("unauthorized");

			// Verify the document still exists
			const { data: stillExists, error: verifyError } =
				await supabaseAdminClient
					.from("documents")
					.select("id")
					.eq("id", testDoc.id)
					.single();

			expect(verifyError).toBeNull();
			expect(stillExists).not.toBeNull();
		} finally {
			// Clean up: delete the test document
			await supabaseAdminClient.from("documents").delete().eq("id", testDoc.id);
		}
	});
});
