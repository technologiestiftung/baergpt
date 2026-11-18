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
import { PDFDocument } from "pdf-lib";
import type { Database } from "@repo/db-schema";
import app from "../../index";
import { config } from "../../config";
import { serviceRoleDbClient } from "../../supabase";
import { signInWithOtp } from "../fixtures/auth";
import { UserScopedDbService } from "../../services/db-service/user-scoped-db-service";
import { GenerationService } from "../../services/generation-service";
import { EmbeddingService } from "../../services/embedding-service";

const supabaseAnonClient = createClient<Database>(
	config.supabaseUrl,
	config.supabaseAnonKey,
);

// Two different users for testing authorization
const USER_A_ID = "a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1";
const USER_A_EMAIL = "user-a-security-test@ts.berlin";

const USER_B_ID = "b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2";
const USER_B_EMAIL = "user-b-security-test@ts.berlin";

let userAToken: string;
let userBToken: string;

const PROCESS_URL = "http://localhost/documents/process";

function pdfFile(): File {
	return new File([new Uint8Array([1, 2, 3])], "test.pdf", {
		type: "application/pdf",
	});
}

// A real (parseable) PDF, needed for tests that must reach a "successful"
// event and a real `documents` row rather than failing during extraction.
async function validPdfFile(fileName = "valid.pdf"): Promise<File> {
	const doc = await PDFDocument.create();
	doc.addPage();
	const bytes = await doc.save({ useObjectStreams: false });
	return new File([bytes.slice()], fileName, { type: "application/pdf" });
}

// Mocked processing outputs so folder-fallback tests can reach a real DB
// insert without hitting the LLM/embedding APIs. Embedding dimensions must
// match the real vector(1024) column or the insert fails.
const MOCK_EXTRACTION_RESULT = {
	parsedPages: [{ content: "page content", tokenCount: 10, pageNumber: 1 }],
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

// The route now takes multipart (file + metadata) and generates the storage
// path itself, so security is enforced on the metadata, not a client source_url.
function createProcessRequest(
	metadata: unknown,
	token: string,
	file: File = pdfFile(),
): Request {
	const form = new FormData();
	form.append("file", file);
	form.append(
		"metadata",
		typeof metadata === "string" ? metadata : JSON.stringify(metadata),
	);

	return new Request(PROCESS_URL, {
		method: "POST",
		headers: { authorization: `Bearer ${token}` },
		body: form,
	});
}

// Failures are delivered in-band as `{ status: "failed.*", error }` SSE events
// on a 200 response. Returns the parsed events (heartbeat pings are empty).
async function readSseEvents(
	response: Response,
): Promise<Array<{ status: string; error?: string; folderFallback?: boolean }>> {
	const text = await response.text();
	return text
		.split("\n")
		.filter((line) => line.startsWith("data: "))
		.map((line) => line.slice(6).trim())
		.filter((payload) => payload.length > 0)
		.map((payload) => JSON.parse(payload));
}

describe("Document Process Security Tests", () => {
	beforeAll(async () => {
		// Create test users
		await Promise.all([
			serviceRoleDbClient.auth.admin.createUser({
				id: USER_A_ID,
				email: USER_A_EMAIL,
				email_confirm: true,
			}),
			serviceRoleDbClient.auth.admin.createUser({
				id: USER_B_ID,
				email: USER_B_EMAIL,
				email_confirm: true,
			}),
		]);

		// Get access tokens
		const [userASession, userBSession] = await Promise.all([
			signInWithOtp(supabaseAnonClient, USER_A_EMAIL),
			signInWithOtp(supabaseAnonClient, USER_B_EMAIL),
		]);

		userAToken = userASession.data.session?.access_token || "";
		userBToken = userBSession.data.session?.access_token || "";
	}, 30_000);

	afterAll(async () => {
		// Cleanup test users and their data
		await Promise.all([
			serviceRoleDbClient.auth.admin.deleteUser(USER_A_ID).catch(() => {}),
			serviceRoleDbClient.auth.admin.deleteUser(USER_B_ID).catch(() => {}),
		]);
	});

	describe("Request Validation", () => {
		it("should reject requests with invalid sourceType", async () => {
			const metadata = {
				document: {
					folderId: null,
					sourceType: "malicious_type", // Invalid
				},
				llmModel: config.defaultDocumentProcessingModel,
			};

			const res = await app.fetch(createProcessRequest(metadata, userAToken));

			const events = await readSseEvents(res);
			const statuses = events.map((e) => e.status);
			expect(statuses).toContain("failed.generic");
			// Validation must fail before processing begins.
			expect(statuses).not.toContain("processing");
		});

		it("should reject path traversal in the (user-supplied) access_group_id", async () => {
			// For public/default documents the storage path prefix comes from the
			// client-supplied accessGroupId. The z.uuid() schema is what prevents a
			// traversal payload from ever reaching the storage path.
			const maliciousAccessGroupIds = [
				"../../../etc/passwd",
				"../../secrets",
				"./nested",
				"//double/slash",
				"/absolute/path",
			];

			for (const accessGroupId of maliciousAccessGroupIds) {
				const metadata = {
					document: {
						folderId: null,
						sourceType: "public_document",
						accessGroupId,
					},
					llmModel: config.defaultDocumentProcessingModel,
				};

				const res = await app.fetch(createProcessRequest(metadata, userAToken));

				const events = await readSseEvents(res);
				const statuses = events.map((e) => e.status);
				expect(statuses).toContain("failed.generic");
				// Validation must fail before processing begins.
				expect(statuses).not.toContain("processing");
			}
		});

		it("should reject requests missing required fields", async () => {
			const metadata = {
				document: {
					// Missing sourceType
					folderId: null,
				},
				// llmModel missing
			};

			const res = await app.fetch(createProcessRequest(metadata, userAToken));

			const events = await readSseEvents(res);
			const statuses = events.map((e) => e.status);
			expect(statuses).toContain("failed.generic");
			// Validation must fail before processing begins.
			expect(statuses).not.toContain("processing");
		});
	});

	describe("Folder Ownership Validation", () => {
		let userAFolderId: number;

		beforeAll(async () => {
			// Create a folder for User A
			const { data, error } = await serviceRoleDbClient
				.from("document_folders")
				.insert({ user_id: USER_A_ID, name: "User A's Folder" })
				.select("id")
				.single();

			if (error) {
				throw error;
			}
			userAFolderId = data.id;
		});

		afterAll(async () => {
			// Cleanup folder
			try {
				await serviceRoleDbClient
					.from("document_folders")
					.delete()
					.eq("id", userAFolderId);
			} catch {
				// Ignore cleanup errors
			}
		});

		// These tests need a real `documents` row to check the persisted
		// folder_id, so they use a valid PDF and mock the expensive steps
		// (OCR/summary/embeddings) rather than hitting the LLM/embedding APIs.
		beforeEach(() => {
			vi.spyOn(
				UserScopedDbService.prototype,
				"extractDocument",
			).mockImplementation(
				async () =>
					({
						...MOCK_EXTRACTION_RESULT,
						checksum: crypto.randomUUID(),
					}) as never,
			);
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

		async function persistedFolderIdFor(
			events: Array<{ status: string; documentId?: number }>,
		): Promise<number | null> {
			const successful = events.find((e) => e.status === "successful");
			expect(successful?.documentId).toBeDefined();

			const { data, error } = await serviceRoleDbClient
				.from("documents")
				.select("folder_id")
				.eq("id", successful!.documentId!)
				.single();
			expect(error).toBeNull();
			return data!.folder_id;
		}

		it("should reject processing document into another user's folder", async () => {
			// User B tries to process a document into User A's folder
			const metadata = {
				document: {
					folderId: userAFolderId,
					sourceType: "personal_document",
				},
				llmModel: config.defaultDocumentProcessingModel,
			};

			const res = await app.fetch(
				createProcessRequest(metadata, userBToken, await validPdfFile()),
			);

			const events = await readSseEvents(res);
			// Another user's folder is treated like a missing one: the request is
			// not rejected (no information leak) and falls back to the main
			// collection, so the document never lands in User A's folder.
			const processing = events.find((e) => e.status === "processing");
			expect(processing?.folderFallback).toBe(true);
			expect(await persistedFolderIdFor(events)).toBeNull();
		});

		it("should fall back to the main collection for a non-existent folder_id", async () => {
			const metadata = {
				document: {
					folderId: 999999, // Non-existent folder
					sourceType: "personal_document",
				},
				llmModel: config.defaultDocumentProcessingModel,
			};

			const res = await app.fetch(
				createProcessRequest(metadata, userAToken, await validPdfFile()),
			);

			const events = await readSseEvents(res);
			const processing = events.find((e) => e.status === "processing");
			expect(processing?.folderFallback).toBe(true);
			expect(await persistedFolderIdFor(events)).toBeNull();
		});

		it("should not set the fallback flag for a valid own folder", async () => {
			const metadata = {
				document: { folderId: userAFolderId, sourceType: "personal_document" },
				llmModel: config.defaultDocumentProcessingModel,
			};

			const res = await app.fetch(
				createProcessRequest(metadata, userAToken, await validPdfFile()),
			);

			const events = await readSseEvents(res);
			const processing = events.find((e) => e.status === "processing");
			expect(processing).toBeDefined();
			expect(processing?.folderFallback).toBeUndefined();
			expect(await persistedFolderIdFor(events)).toBe(userAFolderId);
		});
	});

	describe("Source Type Restrictions", () => {
		it("should only accept valid sourceType values", async () => {
			const invalidTypes = [
				"admin_document",
				"system",
				"PERSONAL_DOCUMENT",
				"",
			];

			for (const invalidType of invalidTypes) {
				const metadata = {
					document: {
						folderId: null,
						sourceType: invalidType,
					},
					llmModel: config.defaultDocumentProcessingModel,
				};

				const res = await app.fetch(createProcessRequest(metadata, userAToken));

				const events = await readSseEvents(res);
				const statuses = events.map((e) => e.status);
				expect(statuses).toContain("failed.generic");
				// Validation must fail before processing begins.
				expect(statuses).not.toContain("processing");
			}
		});
	});
});
