import {
	describe,
	it,
	expect,
	beforeAll,
	afterAll,
	beforeEach,
	afterEach,
	vi,
} from "vitest";
import { createClient } from "@supabase/supabase-js";
import app from "../../index";
import { config } from "../../config";
import { PDFDocument } from "pdf-lib";
import { serviceRoleDbClient } from "../../supabase";
import { Database } from "@repo/db-schema";
import { UserScopedDbService } from "../../services/db-service/user-scoped-db-service";
import { GenerationService } from "../../services/generation-service";
import { EmbeddingService } from "../../services/embedding-service";

const supabaseAnonClient = createClient<Database>(
	config.supabaseUrl,
	config.supabaseAnonKey,
);

let validToken: string;

const OWNER_USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";

// Generate a PDF from text and return bytes
const generatePdfBytesFromText = async (text: string): Promise<Uint8Array> => {
	const doc = await PDFDocument.create();
	const page = doc.addPage();
	page.drawText(text, { x: 50, y: page.getHeight() - 50 });
	return await doc.save({ useObjectStreams: false });
};

// Build a File from raw PDF bytes.
const pdfFileFromBytes = (bytes: Uint8Array, fileName: string): File =>
	new File([bytes.slice()], fileName, { type: "application/pdf" });

type SseEvent = { status: string; error?: string; documentId?: number };

// Failures/success are delivered in-band as SSE events on a 200 response.
const readSseEvents = async (response: Response): Promise<SseEvent[]> => {
	const text = await response.text();
	return text
		.split("\n")
		.filter((line) => line.startsWith("data: "))
		.map((line) => line.slice(6).trim())
		.filter((payload) => payload.length > 0)
		.map((payload) => JSON.parse(payload));
};

// Send a document through the combined upload+process route (multipart) and
// return the emitted SSE events. The route uploads the file to storage itself.
const processViaRoute = async (args: {
	metadata: unknown;
	token: string;
	file: File;
}): Promise<SseEvent[]> => {
	const { metadata, token, file } = args;
	const form = new FormData();
	form.append("file", file);
	form.append("metadata", JSON.stringify(metadata));

	const res = await app.fetch(
		new Request("http://localhost/documents/process", {
			method: "POST",
			headers: { authorization: `Bearer ${token}` },
			body: form,
		}),
	);
	return readSseEvents(res);
};

const personalMetadata = {
	document: { folderId: null, sourceType: "personal_document" },
	llmModel: config.defaultDocumentProcessingModel,
};

// Mocked processing outputs so the tests exercise the route + real DB/storage
// without hitting the API. The chunk embedding must match the vector(1024)
// column, otherwise the real insert fails.
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

const deleteDocument = async (
	documentId: number,
	userToken: string,
): Promise<{ success: boolean; status: number; error?: string }> => {
	const response = await app.request(
		`/documents/${documentId}`,
		{
			method: "DELETE",
			headers: {
				Authorization: `Bearer ${userToken}`,
			},
		},
		{
			JWT_SECRET: config.supabaseJwtKey,
		},
	);

	if (response.status === 204) {
		return { success: true, status: 204 };
	}

	const body = await response.json();
	return {
		success: false,
		status: response.status,
		error: body.error || "Unknown error",
	};
};

/**
 * Comprehensive cleanup function to delete all potentially conflicting document records
 */
const cleanupTestDocuments = async () => {
	try {
		// Get the test user ID
		const testUserId = OWNER_USER_ID;
		const testUserId2 = OTHER_USER_ID;

		// Delete all documents for the test user
		await serviceRoleDbClient
			.from("documents")
			.delete()
			.in("owned_by_user_id", [testUserId, testUserId2]);

		const removeUserFiles = async (userId: string) => {
			const { data, error } = await serviceRoleDbClient.storage
				.from("documents")
				.list(userId);

			if (error) {
				if (!error.message?.includes("not found")) {
					console.error("Error listing storage files:", error);
				}
				return;
			}

			const pathsToRemove = data?.map((file) => `${userId}/${file.name}`) ?? [];

			if (pathsToRemove.length === 0) {
				return;
			}

			const { error: removeError } = await serviceRoleDbClient.storage
				.from("documents")
				.remove(pathsToRemove);

			if (removeError) {
				console.error("Error removing storage files:", removeError);
			}
		};

		await Promise.all([
			removeUserFiles(testUserId),
			removeUserFiles(testUserId2),
		]);
	} catch (error) {
		console.error("Error during test documents cleanup:", error);
	}
};

/**
 * Create a test user in auth.users table
 */
const createTestUser = async (args: {
	userId: string;
	email: string;
	password: string;
}) => {
	const { userId, email, password } = args;

	try {
		const { error: createError } =
			await serviceRoleDbClient.auth.admin.createUser({
				id: userId,
				email,
				password,
				email_confirm: true,
			});

		if (createError && !createError.message.includes("already registered")) {
			console.error("Error creating test user:", createError);
			throw createError;
		}
	} catch (error) {
		console.error("Error during test user creation:", error);
	}
};

const createValidJwtToken = async (
	email: string,
	password: string,
): Promise<string> => {
	const { data, error } = await supabaseAnonClient.auth.signInWithPassword({
		email,
		password,
	});

	expect(error).toBeNull();

	return data.session.access_token;
};

/**
 * Delete the test user from auth.users table
 */
const deleteTestUser = async () => {
	try {
		const { error: deleteError } =
			await serviceRoleDbClient.auth.admin.deleteUser(OWNER_USER_ID);
		const { error: deleteError2 } =
			await serviceRoleDbClient.auth.admin.deleteUser(OTHER_USER_ID);

		if (deleteError && !deleteError.message.includes("not found")) {
			console.error("Error deleting test user:", deleteError);
		}
		if (deleteError2 && !deleteError2.message.includes("not found")) {
			console.error("Error deleting test user 2:", deleteError2);
		}
	} catch (error) {
		console.error("Error during test user deletion:", error);
	}
};

describe("Integration Tests for Routes", () => {
	beforeAll(async () => {
		const email = "test@ts.berlin";
		const password = "SecureTestPassword123!";
		await createTestUser({ userId: OWNER_USER_ID, email, password });
		// Generate JWT token
		validToken = await createValidJwtToken(email, password);

		// Run a full cleanup before all tests
		await cleanupTestDocuments();
	}, 20_000);

	afterAll(async () => {
		await cleanupTestDocuments();
		await deleteTestUser();
	});

	// Mock the expensive processing steps (OCR/summary/embeddings) so the tests
	// exercise the route + real DB/storage without hitting the API. The route
	// still uploads the file and writes real rows via logProcessedDocument.
	beforeEach(() => {
		vi.spyOn(
			UserScopedDbService.prototype,
			"extractDocument",
		).mockResolvedValue(MOCK_EXTRACTION_RESULT as never);
		vi.spyOn(GenerationService.prototype, "summarize").mockResolvedValue(
			MOCK_SUMMARY_DATA as never,
		);
		vi.spyOn(EmbeddingService.prototype, "batchEmbed").mockResolvedValue(
			MOCK_EMBEDDINGS as never,
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("POST /documents/process should process a document and emit a successful event", async () => {
		const pdfBytes = await generatePdfBytesFromText("Test Document");

		const events = await processViaRoute({
			metadata: personalMetadata,
			token: validToken,
			file: pdfFileFromBytes(pdfBytes, "example.pdf"),
		});

		expect(events.map((e) => e.status)).toContain("successful");
	}, 20_000);

	it("POST /documents/process should handle multiple document uploads", async () => {
		const texts = [
			"This is the first test document.",
			"Here is the second document for testing.",
		];
		const fileNames = ["example-1.pdf", "example-2.pdf"];

		for (let i = 0; i < texts.length; i++) {
			const pdfBytes = await generatePdfBytesFromText(texts[i]);

			const events = await processViaRoute({
				metadata: personalMetadata,
				token: validToken,
				file: pdfFileFromBytes(pdfBytes, fileNames[i]),
			});

			expect(events.map((e) => e.status)).toContain("successful");
		}
	}, 20_000);

	it("POST /llm/just-chatting should handle a valid request", async () => {
		// Mock prompt assembly and the LLM stream so the
		// route smoke-test is deterministic and never depends on external APIs.
		vi.spyOn(GenerationService.prototype, "createPrompt").mockResolvedValue({
			messages: [],
			promptClient: null,
		} as never);
		vi.spyOn(
			GenerationService.prototype,
			"generateTextStreamResponse",
		).mockResolvedValue(
			new Response(
				'data: {"type":"text-delta","delta":"hi"}\n\ndata: [DONE]\n\n',
				{
					status: 200,
				},
			),
		);

		const payload = {
			messages: [
				{
					role: "user",
					content: "Hello, can you help me?",
				},
			],
			user_id: OWNER_USER_ID,
			search_type: "all_private",
			allowed_document_ids: [],
			allowed_folder_ids: [],
			llm_model: "mistral-small",
		};

		const res = await app.request("/llm/just-chatting", {
			method: "POST",
			body: JSON.stringify(payload),
			headers: new Headers({
				"Content-Type": "application/json",
				authorization: `Bearer ${validToken}`,
			}),
		});
		expect(res.status).toBe(200);
	}, 20_000);

	it("should return no errors when deleting a document with valid document ID", async () => {
		const pdfBytes = await generatePdfBytesFromText("Document to be deleted");

		const events = await processViaRoute({
			metadata: personalMetadata,
			token: validToken,
			file: pdfFileFromBytes(pdfBytes, "delete-me.pdf"),
		});

		const documentId = events.find(
			(e) => e.status === "successful",
		)?.documentId;
		expect(documentId).toBeDefined();

		// Delete the uploaded document as the authenticated owner
		const deleteResult = await deleteDocument(documentId as number, validToken);
		expect(deleteResult.success).toBe(true);
		expect(deleteResult.status).toBe(204);

		// document should be deleted
		const { data: deletedDocuments } = await serviceRoleDbClient
			.from("documents")
			.select("id")
			.eq("id", documentId as number);
		expect(deletedDocuments).toBeDefined();
		expect(deletedDocuments && deletedDocuments.length).toBe(0);
	}, 20_000);

	it("should cascade document deletion to also delete summaries and chunks", async () => {
		const pdfBytes = await generatePdfBytesFromText(
			"Document to be deleted with cascade",
		);

		const events = await processViaRoute({
			metadata: personalMetadata,
			token: validToken,
			file: pdfFileFromBytes(pdfBytes, "delete-cascade.pdf"),
		});

		const documentId = events.find(
			(e) => e.status === "successful",
		)?.documentId;
		expect(documentId).toBeDefined();

		// Verify the summaries and chunks exist
		const { data: preSummaries } = await serviceRoleDbClient
			.from("document_summaries")
			.select("document_id")
			.eq("document_id", documentId as number);
		expect((preSummaries?.length ?? 0) > 0).toBe(true);

		const { data: preChunks } = await serviceRoleDbClient
			.from("document_chunks")
			.select("document_id")
			.eq("document_id", documentId as number);
		expect((preChunks?.length ?? 0) > 0).toBe(true);

		const deleteResult = await deleteDocument(documentId as number, validToken);
		expect(deleteResult.success).toBe(true);

		// Validate cascade: no summaries and chunks remain
		const { data: postSummaries } = await serviceRoleDbClient
			.from("document_summaries")
			.select("document_id")
			.eq("document_id", documentId as number);
		expect(postSummaries?.length ?? 0).toBe(0);

		const { data: postChunks } = await serviceRoleDbClient
			.from("document_chunks")
			.select("document_id")
			.eq("document_id", documentId as number);
		expect(postChunks?.length ?? 0).toBe(0);
	}, 20_000);

	it("should return error when deleting for non-existent document ID", async () => {
		const deleteResult = await deleteDocument(999, validToken);
		expect(deleteResult.success).toBe(false);
		expect(deleteResult.status).toBe(404);
	}, 20_000);

	it("should return error when deleting documents if document ID is missing", async () => {
		const deleteResult = await deleteDocument(
			null as unknown as number,
			validToken,
		);
		expect(deleteResult.success).toBe(false);
	}, 20_000);

	it("should return error when deleting if document ID is not a number", async () => {
		const deleteResult = await deleteDocument(Number("abc"), validToken);
		expect(deleteResult.success).toBe(false);
	}, 20_000);

	it("should return error when deleting if user is not authenticated", async () => {
		const deleteResult = await deleteDocument(1, "invalid-token");
		expect(deleteResult.success).toBe(false);
		expect(deleteResult.status).toBe(401);
	}, 20_000);

	it("should return error when deleting if user tries to delete another user's document", async () => {
		// Create a document for a different user
		const otherUserEmail = "test2@ts.berlin";
		const password = "SecureTestPassword123!";
		await createTestUser({
			userId: OTHER_USER_ID,
			email: otherUserEmail,
			password,
		});

		const validToken2 = await createValidJwtToken(otherUserEmail, password);

		const pdfBytes = await generatePdfBytesFromText("Document to be deleted");

		// Process a document owned by the OTHER user
		const events = await processViaRoute({
			metadata: personalMetadata,
			token: validToken2,
			file: pdfFileFromBytes(pdfBytes, "delete-me-2.pdf"),
		});
		const docId = events.find((e) => e.status === "successful")?.documentId;
		expect(docId).toBeDefined();

		// The OWNER user must not be able to delete the OTHER user's document
		const deleteResult = await deleteDocument(docId as number, validToken);
		expect(deleteResult.success).toBe(false);
		expect(deleteResult.status).toBe(404);
		// Cleanup
		await serviceRoleDbClient
			.from("documents")
			.delete()
			.eq("id", docId as number);
	}, 20_000);
});
