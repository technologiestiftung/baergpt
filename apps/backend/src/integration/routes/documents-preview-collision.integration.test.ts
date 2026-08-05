import {
	describe,
	it,
	expect,
	vi,
	beforeAll,
	afterAll,
	beforeEach,
} from "vitest";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@repo/db-schema";
import app from "../../index";
import { serviceRoleDbClient } from "../../supabase";
import { config } from "../../config";
import { WordDocumentExtractionService } from "../../services/document-extraction-service";
import { GenerationService } from "../../services/generation-service";
import { defaultDocumentPath } from "../fixtures/constants";

const supabaseAnonClient = createClient<Database>(
	config.supabaseUrl,
	config.supabaseAnonKey,
);

const UUID_PDF_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/;

describe("Documents Route Integration, preview naming collision", () => {
	const givenUserId = "6e8e6e2b-6f0a-4c3d-9c1a-2f7a2b7e5c11";
	const givenUserEmail = "docs-preview-collision-user@ts.berlin";
	const givenUserPassword = "SecurePassword123!";
	const preexistingPdfName = "report.pdf";
	const docxName = "report.docx";
	let accessToken: string;

	beforeAll(async () => {
		await serviceRoleDbClient.auth.admin.createUser({
			id: givenUserId,
			email: givenUserEmail,
			password: givenUserPassword,
			email_confirm: true,
		});
	}, 20_000);

	afterAll(async () => {
		await serviceRoleDbClient.auth.admin.deleteUser(givenUserId);
	});

	beforeEach(async () => {
		const { data } = await supabaseAnonClient.auth.signInWithPassword({
			email: givenUserEmail,
			password: givenUserPassword,
		});
		accessToken = data.session?.access_token || "";

		vi.spyOn(
			WordDocumentExtractionService.prototype,
			"extractWordDocument",
		).mockResolvedValue("mock extracted text");
	});

	async function uploadFixtureAs(fileName: string) {
		const sourceUrl = `${givenUserId}/${fileName}`;
		const file = readFileSync(defaultDocumentPath);
		const { error } = await supabaseAnonClient.storage
			.from("documents")
			.upload(sourceUrl, file, {
				contentType: "application/pdf",
				upsert: true,
			});
		expect(error).toBeNull();
		return sourceUrl;
	}

	async function processDocument(sourceUrl: string) {
		const req = new Request("http://localhost/documents/process", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${accessToken}`,
			},
			body: JSON.stringify({
				document: {
					source_url: sourceUrl,
					source_type: "personal_document",
					folder_id: null,
					owned_by_user_id: givenUserId,
					created_at: new Date().toISOString(),
				},
				llm_model: config.defaultDocumentProcessingModel,
			}),
		});
		return app.fetch(req);
	}

	it("does not collide with, and does not delete, a pre-existing pdf with the same base name", async () => {
		// 1. An unrelated pdf already exists at the base name the docx preview would have used.
		await uploadFixtureAs(preexistingPdfName);

		// 2. Upload and process a docx whose preview would legacy-collide with that pdf.
		const docxSourceUrl = await uploadFixtureAs(docxName);
		const res = await processDocument(docxSourceUrl);

		expect(res.status).toBe(204);

		// 3. The new document row got a UUID-named preview, not "report.pdf".
		const { data: documentRow, error: documentRowError } =
			await serviceRoleDbClient
				.from("documents")
				.select("preview_source_url")
				.eq("source_url", docxSourceUrl)
				.single();
		expect(documentRowError).toBeNull();
		expect(documentRow?.preview_source_url).toBeTruthy();
		const previewFileName = documentRow?.preview_source_url?.split("/").pop();
		expect(previewFileName).toMatch(UUID_PDF_PATTERN);

		// 4. The pre-existing, unrelated pdf is untouched.
		const { data: filesAfter } = await serviceRoleDbClient.storage
			.from("documents")
			.list(givenUserId);
		expect(
			filesAfter?.find((f) => f.name === preexistingPdfName),
		).toBeDefined();

		// Cleanup
		await serviceRoleDbClient
			.from("documents")
			.delete()
			.eq("source_url", docxSourceUrl);
		await serviceRoleDbClient.storage
			.from("documents")
			.remove([
				`${givenUserId}/${preexistingPdfName}`,
				`${givenUserId}/${docxName}`,
				documentRow?.preview_source_url as string,
			]);
	}, 30_000);

	it("only cleans up the preview it just created when processing fails, leaving a pre-existing same-named pdf alone", async () => {
		await uploadFixtureAs(preexistingPdfName);
		const docxSourceUrl = await uploadFixtureAs(docxName);

		const summarizeSpy = vi
			.spyOn(GenerationService.prototype, "summarize")
			.mockRejectedValue(new Error("Forced Failure"));

		const res = await processDocument(docxSourceUrl);
		expect(res.status).toBe(500);

		const { data: filesAfter } = await serviceRoleDbClient.storage
			.from("documents")
			.list(givenUserId);

		// Cleanup-on-failure removes the docx itself (processing never
		// completed, so it never became a real document) and its freshly
		// generated UUID preview...
		expect(filesAfter?.find((f) => f.name === docxName)).toBeUndefined();
		const remainingNames = new Set(filesAfter?.map((f) => f.name));
		const leftoverPreview = [...remainingNames].find((name) =>
			UUID_PDF_PATTERN.test(name),
		);
		expect(leftoverPreview).toBeUndefined();
		// ...but must not touch the pre-existing, unrelated pdf.
		expect(
			filesAfter?.find((f) => f.name === preexistingPdfName),
		).toBeDefined();

		summarizeSpy.mockRestore();

		// Cleanup
		await serviceRoleDbClient.storage
			.from("documents")
			.remove([`${givenUserId}/${preexistingPdfName}`]);
	}, 30_000);
});
