import { describe, it, expect, beforeAll, afterAll } from "vitest";
import app from "../../index";
import { config } from "../../config";
import { sign } from "hono/jwt";
import { PDFDocument } from "pdf-lib";
import { supabase } from "../../supabase";

let validToken: string;

const documentTestPayload = {
	base64Document:
		"data:application/pdf;base64,JVBERi0xLjcKJeLjz9MKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAwIG9iago8PC9UeXBlL1BhZ2VzL0NvdW50IDEvS2lkcyBbMyAwIFJdPj4KZW5kb2JqCjMgMCBvYmoKPDwvVHlwZS9QYWdlL01lZGlhQm94IFswIDAgNTk1IDg0Ml0vUmVzb3VyY2VzPDwvRm9udDw8L0YxIDQgMCBSPj4+Pi9Db250ZW50cyA1IDAgUi9QYXJlbnQgMiAwIFI+PgplbmRvYmoKNCAwIG9iago8PC9UeXBlL0ZvbnQvU3VidHlwZS9UeXBlMS9CYXNlRm9udC9IZWx2ZXRpY2E+PgplbmRvYmoKNSAwIG9iago8PC9MZW5ndGggNDQ+PnN0cmVhbQpCVAoxMCAxMCBURCAvRjEgMTIgVGYgKFRlc3QgRG9jdW1lbnQpIFRqCkVUCmVuZHN0cmVhbQplbmRvYmoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmCjAwMDAwMDAwMTUgMDAwMDAgbgowMDAwMDAwMDY0IDAwMDAwIG4KMDAwMDAwMDEyMyAwMDAwMCBuCjAwMDAwMDAyMzggMDAwMDAgbgowMDAwMDAwMzA2IDAwMDAwIG4KdHJhaWxlcgo8PC9TaXplIDYvUm9vdCAxIDAgUj4+CnN0YXJ0eHJlZgozOTkKJSVFT0YK",
	document: {
		filename: "example.pdf",
		id: 123,
		owned_by_user_id: "11111111-1111-1111-1111-111111111111",
		registered_at: new Date().toISOString(),
		source_type: "personal_document",
		source_url: "example/file.pdf",
	},
};

/**
 * Comprehensive cleanup function to delete all potentially conflicting document records
 */
const cleanupTestDocuments = async () => {
	try {
		// Get the test user ID
		const testUserId = "11111111-1111-1111-1111-111111111111";
		const testUserId2 = "22222222-2222-2222-2222-222222222222";

		// Delete all documents for the test user
		await supabase
			.from("documents")
			.delete()
			.in("owned_by_user_id", [testUserId, testUserId2]);
	} catch (error) {
		console.error("Error during test documents cleanup:", error);
	}
};

/**
 * Generate a base64 encoded PDF directly in memory from text content
 * without saving to disk
 */
const generateBase64FromText = async (text: string): Promise<string> => {
	const doc = await PDFDocument.create();
	doc.addPage().drawText(text);
	const pdfBytes = await doc.save();

	// Convert bytes directly to base64 string without saving to disk
	const base64 = Buffer.from(pdfBytes).toString("base64");
	return `data:application/pdf;base64,${base64}`;
};

/**
 * Helper function to add delay between API calls
 */
const delay = (ms: number): Promise<void> => {
	return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Create a test user in auth.users table
 */
const createTestUser = async (userId: string, email: string) => {
	try {
		const { error: createError } = await supabase.auth.admin.createUser({
			id: userId,
			email: email,
			password: "SecureTestPassword123!",
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
	userId: string,
	email: string,
): Promise<string> => {
	return await sign(
		{
			exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour from now
			sub: userId,
			email: email,
			role: "authenticated",
		},
		config.supabaseJwtKey,
	);
};

/**
 * Delete the test user from auth.users table
 */
const deleteTestUser = async () => {
	try {
		const testUserId = "11111111-1111-1111-1111-111111111111";
		const testUserId2 = "22222222-2222-2222-2222-222222222222";
		const { error: deleteError } =
			await supabase.auth.admin.deleteUser(testUserId);
		const { error: deleteError2 } =
			await supabase.auth.admin.deleteUser(testUserId2);

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
		const userId = "11111111-1111-1111-1111-111111111111";
		const email = "test@example.com";
		await createTestUser(userId, email);
		// Generate JWT token
		validToken = await createValidJwtToken(userId, email);

		// Run a full cleanup before all tests
		await cleanupTestDocuments();
	});

	afterAll(async () => {
		await cleanupTestDocuments();
		await deleteTestUser();
	});

	it("POST /documents/process should process a document and return 204", async () => {
		const res = await app.request("/documents/process", {
			method: "POST",
			body: JSON.stringify(documentTestPayload),
			headers: new Headers({
				"Content-Type": "application/json",
				authorization: `Bearer ${validToken}`,
			}),
		});

		if (res.status !== 204) {
			const responseText = await res.text();
			console.error(`Test failed with status ${res.status}:`, responseText);
		}

		expect(res.status).toBe(204);
	}, 400_000);

	it("POST /documents/process should handle multiple document uploads", async () => {
		const texts = [
			"This is the first test document.",
			"Here is the second document for testing.",
		];
		const documentIds = [1, 2];

		const payloads = await Promise.all(
			texts.map(async (text, index) => ({
				base64Document: await generateBase64FromText(text),
				document: {
					filename: `example-${index}.pdf`,
					id: documentIds[index],
					owned_by_user_id: "11111111-1111-1111-1111-111111111111",
					registered_at: new Date().toISOString(),
					source_type: "personal_document",
					source_url: `example/file-${documentIds[index]}.pdf`,
				},
			})),
		);

		// Send requests sequentially with delay between them to avoid rate limits
		for (const payload of payloads) {
			const res = await app.request("/documents/process", {
				method: "POST",
				body: JSON.stringify(payload),
				headers: new Headers({
					"Content-Type": "application/json",
					authorization: `Bearer ${validToken}`,
				}),
			});
			await delay(1000); // 1 second delay between requests
			if (res.status !== 204) {
				const responseText = await res.text();
				console.error(
					`Document processing error for ID ${payload.document.id} (status ${res.status}):`,
					responseText,
				);
				if (res.status === 429) {
					console.warn("Rate limit hit, retrying after delay...");
					await delay(5000);
					const retryRes = await app.request("/documents/process", {
						method: "POST",
						body: JSON.stringify(payload),
						headers: new Headers({
							"Content-Type": "application/json",
							authorization: `Bearer ${validToken}`,
						}),
					});
					expect(retryRes.status).toBe(204);
				} else {
					throw new Error(`Unexpected status ${res.status}: ${responseText}`);
				}
			} else {
				expect(res.status).toBe(204);
			}
		}
	}, 600_000);

	it("POST /llm/just-chatting should handle a valid request", async () => {
		const payload = {
			messages: [
				{
					role: "user",
					content: "Hello, can you help me?",
				},
			],
			user_id: "11111111-1111-1111-1111-111111111111",
			search_type: "all_private",
			allowed_document_ids: [],
			allowed_folder_ids: [],
		};

		const res = await app.request("/llm/just-chatting", {
			method: "POST",
			body: JSON.stringify(payload),
			headers: new Headers({
				"Content-Type": "application/json",
				authorization: `Bearer ${validToken}`,
			}),
		});
		expect(res.status).not.toBe(401);
	}, 80_000);

	it("DELETE /documents/:id should return 204 for valid document ID", async () => {
		const userId = "11111111-1111-1111-1111-111111111111";
		const sourceUrl = "delete-me/file.pdf";
		// Upload a new document first
		const newDocPayload = {
			base64Document: await generateBase64FromText("Document to be deleted"),
			document: {
				filename: "delete-me.pdf",
				owned_by_user_id: userId,
				registered_at: new Date().toISOString(),
				source_type: "personal_document",
				source_url: sourceUrl,
			},
		};
		const uploadRes = await app.request("/documents/process", {
			method: "POST",
			body: JSON.stringify(newDocPayload),
			headers: new Headers({
				"Content-Type": "application/json",
				authorization: `Bearer ${validToken}`,
			}),
		});
		expect(uploadRes.status).toBe(204);

		// Get the uploaded document ID
		const { data: documents } = await supabase
			.from("documents")
			.select("id")
			.eq("source_url", sourceUrl)
			.eq("owned_by_user_id", userId)
			.order("created_at", { ascending: false })
			.limit(1);

		expect(documents).toBeDefined();
		expect(documents && documents.length).toBeGreaterThan(0);
		const documentId =
			documents && documents.length > 0 ? documents[0].id : undefined;
		expect(documentId).toBeDefined();

		// Delete the uploaded document
		const res = await app.request(`/documents/${documentId}`, {
			method: "DELETE",
			headers: new Headers({ authorization: `Bearer ${validToken}` }),
		});
		expect(res.status).toBe(204);
	}, 80_000);

	it("DELETE /documents/:id should return 400 for non-existent document ID", async () => {
		const res = await app.request("/documents/999", {
			method: "DELETE",
			headers: new Headers({ authorization: `Bearer ${validToken}` }),
		});
		expect(res.status).toBe(400);
	}, 80_000);

	it("DELETE /documents/:id should return 404 if document ID is missing", async () => {
		const res = await app.request("/documents/", {
			method: "DELETE",
			headers: new Headers({ authorization: `Bearer ${validToken}` }),
		});
		expect(404).toBe(res.status);
	}, 20_000);

	it("DELETE /documents/:id should return 400 if document ID is not a number", async () => {
		const res = await app.request("/documents/abc", {
			method: "DELETE",
			headers: new Headers({ authorization: `Bearer ${validToken}` }),
		});
		expect(res.status).toBe(400);
	}, 20_000);

	it("DELETE /documents/:id should return 401 if user is not authenticated", async () => {
		const res = await app.request("/documents/1", {
			method: "DELETE",
			// No Authorization header
		});
		expect(res.status).toBe(401);
	}, 20_000);

	it("DELETE /documents/:id should return 400 if user tries to delete another user's document", async () => {
		// Create a document for a different user
		const otherUserId = "22222222-2222-2222-2222-222222222222";
		const otherUserEmail = "test2@example.com";
		const docId = 555;
		await createTestUser(otherUserId, otherUserEmail);

		const validToken2 = await createValidJwtToken(otherUserId, otherUserEmail);

		const newDocPayload2 = {
			base64Document: await generateBase64FromText("Document to be deleted"),
			document: {
				filename: "delete-me-2.pdf",
				owned_by_user_id: otherUserId,
				registered_at: new Date().toISOString(),
				source_type: "personal_document",
				source_url: "delete-me-2/file.pdf",
			},
		};

		const uploadRes = await app.request("/documents/process", {
			method: "POST",
			body: JSON.stringify(newDocPayload2),
			headers: new Headers({
				"Content-Type": "application/json",
				authorization: `Bearer ${validToken2}`,
			}),
		});
		expect(uploadRes.status).toBe(204);

		const res = await app.request(`/documents/${docId}`, {
			method: "DELETE",
			headers: new Headers({ authorization: `Bearer ${validToken}` }),
		});
		expect(res.status).toBe(400); // Should not allow deletion
		// Cleanup
		await supabase.from("documents").delete().eq("id", docId);
	}, 60_000);
});
