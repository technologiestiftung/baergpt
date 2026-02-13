import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import app from "../../index";
import { config } from "../../config";
import { sign } from "hono/jwt";
import { PDFDocument } from "pdf-lib";
import { serviceRoleDbClient } from "../../supabase";
import { initQueues } from "../../services/distributed-limiter";

let validToken: string;

const OWNER_USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";

const UPLOAD_DELAY_MS = 1_000;
const RATE_LIMIT_RETRY_DELAY_MS = 5_000;

// Generate a PDF from text and return bytes
const generatePdfBytesFromText = async (text: string): Promise<Uint8Array> => {
	const doc = await PDFDocument.create();
	const page = doc.addPage();
	page.drawText(text, { x: 50, y: page.getHeight() - 50 });
	return await doc.save({ useObjectStreams: false });
};

// Upload bytes directly to Supabase storage
const uploadToStorage = async (args: {
	bytes: Uint8Array;
	sourceUrl: string;
	fileName: string;
	userToken: string;
}): Promise<void> => {
	const { bytes, sourceUrl, fileName, userToken } = args;
	const file = new File([bytes.slice()], fileName, { type: "application/pdf" });

	const userClient = createClient(
		process.env.SUPABASE_URL as string,
		process.env.SUPABASE_ANON_KEY as string,
		{ global: { headers: { Authorization: `Bearer ${userToken}` } } },
	);

	const { error } = await userClient.storage
		.from("documents")
		.upload(sourceUrl, file, {
			contentType: "application/pdf",
		});

	if (error) {
		throw new Error(`Storage upload error: ${error.message}`);
	}
};

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

async function getLatestDocumentIdBySourceUrl(
	ownerId: string,
	sourceUrl: string,
): Promise<number | undefined> {
	const { data } = await serviceRoleDbClient
		.from("documents")
		.select("id")
		.eq("source_url", sourceUrl)
		.eq("owned_by_user_id", ownerId)
		.order("created_at", { ascending: false })
		.limit(1);

	return data && data.length > 0 ? data[0].id : undefined;
}

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
		const { error: createError } =
			await serviceRoleDbClient.auth.admin.createUser({
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
		// Initialize queues for the test process
		await initQueues();

		const email = "test@local.berlin.de";
		await createTestUser(OWNER_USER_ID, email);
		// Generate JWT token
		validToken = await createValidJwtToken(OWNER_USER_ID, email);

		// Run a full cleanup before all tests
		await cleanupTestDocuments();
	}, 20_000);

	afterAll(async () => {
		await cleanupTestDocuments();
		await deleteTestUser();
	});

	it("POST /documents/process should process a document and return 204", async () => {
		const fileName = "example.pdf";
		const sourceUrl = `${OWNER_USER_ID}/${fileName}`;
		const pdfBytes = await generatePdfBytesFromText("Test Document");

		await uploadToStorage({
			bytes: pdfBytes,
			sourceUrl,
			fileName,
			userToken: validToken,
		});

		const payload = {
			document: {
				file_name: fileName,
				owned_by_user_id: OWNER_USER_ID,
				registered_at: new Date().toISOString(),
				source_type: "personal_document",
				source_url: sourceUrl,
				folder_id: null,
			},
			llm_model: "mistral-small",
		};

		const res = await app.request("/documents/process", {
			method: "POST",
			body: JSON.stringify(payload),
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
		const fileNames = ["example-1.pdf", "example-2.pdf"];
		const sourceUrls = fileNames.map(
			(fileName) => `${OWNER_USER_ID}/${fileName}`,
		);

		for (let i = 0; i < texts.length; i++) {
			const pdfBytes = await generatePdfBytesFromText(texts[i]);

			await uploadToStorage({
				bytes: pdfBytes,
				sourceUrl: sourceUrls[i],
				fileName: fileNames[i],
				userToken: validToken,
			});

			const payload = {
				document: {
					file_name: fileNames[i],
					owned_by_user_id: OWNER_USER_ID,
					registered_at: new Date().toISOString(),
					source_type: "personal_document",
					source_url: sourceUrls[i],
					folder_id: null,
				},
				llm_model: config.defaultDocumentProcessingModel,
			};

			const res = await app.request("/documents/process", {
				method: "POST",
				body: JSON.stringify(payload),
				headers: new Headers({
					"Content-Type": "application/json",
					authorization: `Bearer ${validToken}`,
				}),
			});
			await delay(UPLOAD_DELAY_MS);
			if (res.status !== 204) {
				const responseText = await res.text();
				if (res.status === 429) {
					console.warn("Rate limit hit, retrying after delay...");
					await delay(RATE_LIMIT_RETRY_DELAY_MS);
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
			user_id: OWNER_USER_ID,
			search_type: "all_private",
			allowed_document_ids: [],
			allowed_folder_ids: [],
			llm_model: config.smallModelIdentifier,
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

	it("should return no errors when deleting a document with valid document ID", async () => {
		const fileName = "delete-me.pdf";
		const sourceUrl = `${OWNER_USER_ID}/${fileName}`;
		const pdfBytes = await generatePdfBytesFromText("Document to be deleted");

		await uploadToStorage({
			bytes: pdfBytes,
			sourceUrl,
			fileName,
			userToken: validToken,
		});

		const newDocPayload = {
			document: {
				file_name: fileName,
				owned_by_user_id: OWNER_USER_ID,
				registered_at: new Date().toISOString(),
				source_type: "personal_document",
				source_url: sourceUrl,
				folder_id: null,
			},
			llm_model: config.defaultDocumentProcessingModel,
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
		const documentId = await getLatestDocumentIdBySourceUrl(
			OWNER_USER_ID,
			sourceUrl,
		);
		expect(documentId).toBeDefined();

		// Delete the uploaded document as the authenticated owner
		const deleteResult = await deleteDocument(documentId as number, validToken);
		expect(deleteResult.success).toBe(true);
		expect(deleteResult.status).toBe(204);

		// document should be deleted
		const { data: deletedDocuments } = await serviceRoleDbClient
			.from("documents")
			.select("id")
			.eq("source_url", sourceUrl)
			.eq("owned_by_user_id", OWNER_USER_ID)
			.order("created_at", { ascending: false })
			.limit(1);
		expect(deletedDocuments).toBeDefined();
		expect(deletedDocuments && deletedDocuments.length).toBe(0);
	}, 100_000);

	it("should cascade document deletion to also delete summaries and chunks", async () => {
		const fileName = "delete-cascade.pdf";
		const sourceUrl = `${OWNER_USER_ID}/${fileName}`;
		const pdfBytes = await generatePdfBytesFromText(
			"Document to be deleted with cascade",
		);

		await uploadToStorage({
			bytes: pdfBytes,
			sourceUrl,
			fileName,
			userToken: validToken,
		});

		const newDocPayload = {
			document: {
				file_name: fileName,
				owned_by_user_id: OWNER_USER_ID,
				registered_at: new Date().toISOString(),
				source_type: "personal_document",
				source_url: sourceUrl,
				folder_id: null,
			},
			llm_model: config.defaultDocumentProcessingModel,
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
		const documentId = await getLatestDocumentIdBySourceUrl(
			OWNER_USER_ID,
			sourceUrl,
		);
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
	}, 80_000);

	it("should return error when deleting for non-existent document ID", async () => {
		const deleteResult = await deleteDocument(999, validToken);
		expect(deleteResult.success).toBe(false);
		expect(deleteResult.status).toBe(404);
	}, 80_000);

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
		const otherUserEmail = "test2@local.berlin.de";
		await createTestUser(OTHER_USER_ID, otherUserEmail);

		const validToken2 = await createValidJwtToken(
			OTHER_USER_ID,
			otherUserEmail,
		);

		const fileName = "delete-me-2.pdf";
		const sourceUrl = `${OTHER_USER_ID}/${fileName}`;
		const pdfBytes = await generatePdfBytesFromText("Document to be deleted");

		await uploadToStorage({
			bytes: pdfBytes,
			sourceUrl,
			fileName,
			userToken: validToken2,
		});

		const payload2 = {
			document: {
				file_name: fileName,
				owned_by_user_id: OTHER_USER_ID,
				registered_at: new Date().toISOString(),
				source_type: "personal_document",
				source_url: sourceUrl,
				folder_id: null,
			},
			llm_model: config.defaultDocumentProcessingModel,
		};

		const uploadRes = await app.request("/documents/process", {
			method: "POST",
			body: JSON.stringify(payload2),
			headers: new Headers({
				"Content-Type": "application/json",
				authorization: `Bearer ${validToken2}`,
			}),
		});
		expect(uploadRes.status).toBe(204);
		const docId = await getLatestDocumentIdBySourceUrl(
			OTHER_USER_ID,
			sourceUrl,
		);
		expect(docId).toBeDefined();
		const deleteResult = await deleteDocument(docId as number, validToken);
		expect(deleteResult.success).toBe(false);
		expect(deleteResult.status).toBe(404);
		// Cleanup
		await serviceRoleDbClient
			.from("documents")
			.delete()
			.eq("id", docId as number);
	}, 60_000);
});
