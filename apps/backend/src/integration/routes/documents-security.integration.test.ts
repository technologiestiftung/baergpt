import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@repo/db-schema";
import app from "../../index";
import { config } from "../../config";
import { supabase } from "../../supabase";
import { initQueues } from "../../services/distributed-limiter";

const supabaseAnonClient = createClient<Database>(
	config.supabaseUrl,
	config.supabaseAnonKey,
);

// Two different users for testing authorization
const USER_A_ID = "a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1";
const USER_A_EMAIL = "user-a-security-test@local.berlin.de";
const USER_A_PASSWORD = "SecurePassword123!";

const USER_B_ID = "b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2";
const USER_B_EMAIL = "user-b-security-test@local.berlin.de";
const USER_B_PASSWORD = "SecurePassword456!";

let userAToken: string;
let userBToken: string;

describe("Document Process Security Tests", () => {
	beforeAll(async () => {
		// Create test users
		await Promise.all([
			supabase.auth.admin.createUser({
				id: USER_A_ID,
				email: USER_A_EMAIL,
				password: USER_A_PASSWORD,
				email_confirm: true,
			}),
			supabase.auth.admin.createUser({
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

		await initQueues();
	}, 30_000);

	afterAll(async () => {
		// Cleanup test users and their data
		await Promise.all([
			supabase.auth.admin.deleteUser(USER_A_ID).catch(() => {}),
			supabase.auth.admin.deleteUser(USER_B_ID).catch(() => {}),
		]);
	});

	describe("Request Validation", () => {
		it("should reject requests with invalid source_type", async () => {
			const payload = {
				document: {
					source_url: `${USER_A_ID}/test.pdf`,
					source_type: "malicious_type", // Invalid
					owned_by_user_id: USER_A_ID,
				},
			};

			const res = await app.request("/documents/process", {
				method: "POST",
				body: JSON.stringify(payload),
				headers: new Headers({
					"Content-Type": "application/json",
					authorization: `Bearer ${userAToken}`,
				}),
			});

			expect(res.status).toBe(400);
			const body = await res.json();
			expect(body.error).toContain("Validation failed");
		});

		it("should reject requests with path traversal in source_url", async () => {
			const maliciousUrls = [
				`../../../etc/passwd`,
				`${USER_A_ID}/../../../etc/passwd`,
				`./test.pdf`,
				`//double/slash`,
				`/absolute/path.pdf`,
			];

			for (const sourceUrl of maliciousUrls) {
				const payload = {
					document: {
						source_url: sourceUrl,
						source_type: "personal_document",
						owned_by_user_id: USER_A_ID,
					},
				};

				const res = await app.request("/documents/process", {
					method: "POST",
					body: JSON.stringify(payload),
					headers: new Headers({
						"Content-Type": "application/json",
						authorization: `Bearer ${userAToken}`,
					}),
				});

				expect(res.status).toBe(400);
				const body = await res.json();
				expect(body.error).toContain("Validation failed");
			}
		});

		it("should reject requests with empty source_url", async () => {
			const payload = {
				document: {
					source_url: "",
					source_type: "personal_document",
					owned_by_user_id: USER_A_ID,
				},
			};

			const res = await app.request("/documents/process", {
				method: "POST",
				body: JSON.stringify(payload),
				headers: new Headers({
					"Content-Type": "application/json",
					authorization: `Bearer ${userAToken}`,
				}),
			});

			expect(res.status).toBe(400);
		});

		it("should reject requests missing required fields", async () => {
			const payload = {
				document: {
					// Missing source_url and source_type
					owned_by_user_id: USER_A_ID,
				},
			};

			const res = await app.request("/documents/process", {
				method: "POST",
				body: JSON.stringify(payload),
				headers: new Headers({
					"Content-Type": "application/json",
					authorization: `Bearer ${userAToken}`,
				}),
			});

			expect(res.status).toBe(400);
		});
	});

	describe("User ID Spoofing Prevention", () => {
		it("should reject processing documents in another user's storage folder", async () => {
			// User A tries to process a document claiming it's in User B's folder
			const payload = {
				document: {
					source_url: `${USER_B_ID}/stolen-doc.pdf`, // Trying to access User B's storage
					source_type: "personal_document",
					owned_by_user_id: USER_B_ID, // Trying to spoof as User B
					folder_id: null,
				},
			};

			const res = await app.request("/documents/process", {
				method: "POST",
				body: JSON.stringify(payload),
				headers: new Headers({
					"Content-Type": "application/json",
					authorization: `Bearer ${userAToken}`, // But authenticating as User A
				}),
			});

			// Should be rejected because the authenticated user (A) doesn't match the path prefix (B)
			expect(res.status).toBe(403);
			const body = await res.json();
			expect(body.error).toContain("Unauthorized");
		});

		it("should reject processing document with spoofed owned_by_user_id even if file doesn't exist", async () => {
			// User A tries to claim ownership for User B
			const payload = {
				document: {
					source_url: `${USER_A_ID}/my-doc.pdf`, // User A's folder
					source_type: "personal_document",
					owned_by_user_id: USER_B_ID, // Trying to assign to User B
					folder_id: null,
				},
			};

			const res = await app.request("/documents/process", {
				method: "POST",
				body: JSON.stringify(payload),
				headers: new Headers({
					"Content-Type": "application/json",
					authorization: `Bearer ${userAToken}`,
				}),
			});

			// Should fail with 404 because file doesn't exist (but importantly,
			// even if it succeeded, the document would be owned by User A, not User B)
			expect(res.status).toBe(404);
		});
	});

	describe("Folder Ownership Validation", () => {
		let userAFolderId: number;

		beforeAll(async () => {
			// Create a folder for User A
			const { data, error } = await supabase
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
				await supabase
					.from("document_folders")
					.delete()
					.eq("id", userAFolderId);
			} catch {
				// Ignore cleanup errors
			}
		});

		it("should reject processing document into another user's folder", async () => {
			// User B tries to process a document into User A's folder
			const payload = {
				document: {
					source_url: `${USER_B_ID}/test-doc.pdf`,
					source_type: "personal_document",
					folder_id: userAFolderId,
					owned_by_user_id: USER_B_ID,
				},
			};

			const res = await app.request("/documents/process", {
				method: "POST",
				body: JSON.stringify(payload),
				headers: new Headers({
					"Content-Type": "application/json",
					authorization: `Bearer ${userBToken}`,
				}),
			});

			expect(res.status).toBe(403);
			const body = await res.json();
			expect(body.error).toContain(
				"folder_id does not belong to the authenticated user",
			);
		});

		it("should reject non-existent folder_id", async () => {
			const payload = {
				document: {
					source_url: `${USER_A_ID}/test-doc.pdf`,
					source_type: "personal_document",
					folder_id: 999999, // Non-existent folder
					owned_by_user_id: USER_A_ID,
				},
			};

			const res = await app.request("/documents/process", {
				method: "POST",
				body: JSON.stringify(payload),
				headers: new Headers({
					"Content-Type": "application/json",
					authorization: `Bearer ${userAToken}`,
				}),
			});

			expect(res.status).toBe(403);
		});
	});

	describe("File Existence Validation", () => {
		it("should reject processing non-existent file", async () => {
			const payload = {
				document: {
					source_url: `${USER_A_ID}/non-existent-file.pdf`,
					source_type: "personal_document",
					owned_by_user_id: USER_A_ID,
					folder_id: null,
				},
			};

			const res = await app.request("/documents/process", {
				method: "POST",
				body: JSON.stringify(payload),
				headers: new Headers({
					"Content-Type": "application/json",
					authorization: `Bearer ${userAToken}`,
				}),
			});

			expect(res.status).toBe(404);
			const body = await res.json();
			expect(body.error).toContain("File not found");
		});
	});

	describe("Source Type Restrictions", () => {
		it("should only accept valid source_type values", async () => {
			const invalidTypes = [
				"admin_document",
				"system",
				"PERSONAL_DOCUMENT",
				"",
			];

			for (const invalidType of invalidTypes) {
				const payload = {
					document: {
						source_url: `${USER_A_ID}/test.pdf`,
						source_type: invalidType,
						owned_by_user_id: USER_A_ID,
					},
				};

				const res = await app.request("/documents/process", {
					method: "POST",
					body: JSON.stringify(payload),
					headers: new Headers({
						"Content-Type": "application/json",
						authorization: `Bearer ${userAToken}`,
					}),
				});

				expect(res.status).toBe(400);
			}
		});
	});
});
