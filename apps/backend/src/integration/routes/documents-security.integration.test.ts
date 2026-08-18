import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@repo/db-schema";
import app from "../../index";
import { config } from "../../config";
import { serviceRoleDbClient } from "../../supabase";

const supabaseAnonClient = createClient<Database>(
	config.supabaseUrl,
	config.supabaseAnonKey,
);

// Two different users for testing authorization
const USER_A_ID = "a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1";
const USER_A_EMAIL = "user-a-security-test@ts.berlin";
const USER_A_PASSWORD = "SecurePassword123!";

const USER_B_ID = "b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2";
const USER_B_EMAIL = "user-b-security-test@ts.berlin";
const USER_B_PASSWORD = "SecurePassword456!";

let userAToken: string;
let userBToken: string;

const PROCESS_URL = "http://localhost/documents/process";

function pdfFile(): File {
	return new File([new Uint8Array([1, 2, 3])], "test.pdf", {
		type: "application/pdf",
	});
}

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
): Promise<Array<{ status: string; error?: string }>> {
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
				password: USER_A_PASSWORD,
				email_confirm: true,
			}),
			serviceRoleDbClient.auth.admin.createUser({
				id: USER_B_ID,
				email: USER_B_EMAIL,
				password: USER_B_PASSWORD,
				email_confirm: true,
			}),
		]);

		// Get access tokens
		const [userASession, userBSession] = await Promise.all([
			supabaseAnonClient.auth.signInWithPassword({
				email: USER_A_EMAIL,
				password: USER_A_PASSWORD,
			}),
			supabaseAnonClient.auth.signInWithPassword({
				email: USER_B_EMAIL,
				password: USER_B_PASSWORD,
			}),
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

		it("should reject processing document into another user's folder", async () => {
			// User B tries to process a document into User A's folder
			const metadata = {
				document: {
					folderId: userAFolderId,
					sourceType: "personal_document",
				},
				llmModel: config.defaultDocumentProcessingModel,
			};

			const res = await app.fetch(createProcessRequest(metadata, userBToken));

			const events = await readSseEvents(res);
			const statuses = events.map((e) => e.status);
			// The route surfaces validation failures as a generic in-band error
			// (the specific reason is only captured server-side, not exposed to the
			// client), so we assert the failure status rather than the message.
			expect(statuses).toContain("failed.generic");
			// Validation must fail before processing begins.
			expect(statuses).not.toContain("processing");
		});

		it("should reject non-existent folder_id", async () => {
			const metadata = {
				document: {
					folderId: 999999, // Non-existent folder
					sourceType: "personal_document",
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
