import {
	describe,
	it,
	expect,
	vi,
	beforeEach,
	afterEach,
	beforeAll,
	afterAll,
} from "vitest";
import app from "../../index";
import { createUserScopedDbClient, serviceRoleDbClient } from "../../supabase";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@repo/db-schema";
import { config } from "../../config";
import { GenerationService } from "../../services/generation-service";
import { UserScopedDbService } from "../../services/db-service/user-scoped-db-service";
import { WordDocumentExtractionService } from "../../services/document-extraction-service";
import {
	defaultDocumentName,
	defaultDocumentPath,
} from "../fixtures/constants";
import { readFileSync } from "node:fs";

const supabaseAnonClient = createClient<Database>(
	config.supabaseUrl,
	config.supabaseAnonKey,
);

describe("Documents Route Integration", () => {
	const givenUserId = "d279dcb8-ec47-410b-acfc-6d8fdf8a4d85";
	const givenUserEmail = "docs-test-suite-user@ts.berlin";
	const givenUserPassword = "SecurePassword123!";
	let accessToken: string;

	beforeAll(async () => {
		// Cleanup in case of previous test failures
		await serviceRoleDbClient.auth.admin.deleteUser(givenUserId);

		// Create user
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
	});

	it("should not leave an orphaned storage file when processing fails", async () => {
		// The route uploads to storage only as the LAST step (after logging the
		// document). If processing fails before that, nothing should have been
		// written to storage.

		// Baseline: whatever is already in the user's folder.
		const { data: listBefore } = await serviceRoleDbClient.storage
			.from("documents")
			.list(givenUserId);
		const countBefore = listBefore?.length ?? 0;

		// Mock extraction (avoid real OCR) and force summarize to fail.
		const extractSpy = vi
			.spyOn(UserScopedDbService.prototype, "extractDocument")
			.mockResolvedValue({
				parsedPages: [{ content: "content", tokenCount: 1, pageNumber: 1 }],
				checksum: "checksum",
				fileSize: 1,
				numPages: 1,
			} as never);
		const summarizeSpy = vi
			.spyOn(GenerationService.prototype, "summarize")
			.mockRejectedValue(new Error("Forced Failure"));

		// Send the file through the combined upload+process route (multipart).
		const file = new File(
			[new Uint8Array(readFileSync(defaultDocumentPath))],
			defaultDocumentName,
			{ type: "application/pdf" },
		);
		const form = new FormData();
		form.append("file", file);
		form.append(
			"metadata",
			JSON.stringify({
				document: { folderId: null, sourceType: "personal_document" },
				llmModel: config.defaultDocumentProcessingModel,
			}),
		);

		const res = await app.fetch(
			new Request("http://localhost/documents/process", {
				method: "POST",
				headers: { Authorization: `Bearer ${accessToken}` },
				body: form,
			}),
		);

		// Failure is delivered in-band as an SSE event, not an HTTP error code.
		const text = await res.text();
		expect(text).toContain("failed.generic");

		// No new file should have been written to storage.
		const { data: listAfter } = await serviceRoleDbClient.storage
			.from("documents")
			.list(givenUserId);
		expect(listAfter?.length ?? 0).toBe(countBefore);

		extractSpy.mockRestore();
		summarizeSpy.mockRestore();
	}, 20_000);

	describe("uploadFileToStorage – docx preview generation", () => {
		const bucket = "documents";
		const docxPath = `${givenUserId}/preview-int-test.docx`;
		const pdfPath = `${givenUserId}/preview-int-test.pdf`;
		const xlsxPath = `${givenUserId}/preview-int-test.xlsx`;

		function buildService() {
			return new UserScopedDbService(createUserScopedDbClient(accessToken));
		}

		// Best-effort cleanup before and after so a stale file from a crashed run
		// can't cause a duplicate-upload error.
		const removeAll = () =>
			serviceRoleDbClient.storage
				.from(bucket)
				.remove([docxPath, pdfPath, xlsxPath]);
		beforeEach(removeAll);
		afterEach(removeAll);

		it("uploads the docx and generates a .pdf preview in the same bucket", async () => {
			const file = new File(
				[new Uint8Array([1, 2, 3])],
				"preview-int-test.docx",
				{
					type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
				},
			);

			await buildService().uploadFileToStorage(docxPath, file, bucket);

			const { data } = await serviceRoleDbClient.storage
				.from(bucket)
				.list(givenUserId);
			const names = data?.map((f) => f.name) ?? [];
			expect(names).toContain("preview-int-test.docx");
			expect(names).toContain("preview-int-test.pdf");
		}, 20_000);

		it("does not generate a preview for a non-docx file", async () => {
			const file = new File(
				[new Uint8Array([1, 2, 3])],
				"preview-int-test.xlsx",
				{
					type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
				},
			);

			await buildService().uploadFileToStorage(xlsxPath, file, bucket);

			const { data } = await serviceRoleDbClient.storage
				.from(bucket)
				.list(givenUserId);
			const names = data?.map((f) => f.name) ?? [];
			expect(names).toContain("preview-int-test.xlsx");
			expect(names).not.toContain("preview-int-test.pdf");
		}, 20_000);

		it("propagates the error when preview generation fails, leaving no preview", async () => {
			const givenError = new Error("Some Error");
			const spy = vi
				.spyOn(WordDocumentExtractionService.prototype, "convertWordToPdf")
				.mockRejectedValue(givenError);
			const file = new File(
				[new Uint8Array([1, 2, 3])],
				"preview-int-test.docx",
				{
					type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
				},
			);

			await expect(
				buildService().uploadFileToStorage(docxPath, file, bucket),
			).rejects.toThrow(givenError);

			// The original docx uploaded before the preview step failed; no .pdf exists.
			const { data } = await serviceRoleDbClient.storage
				.from(bucket)
				.list(givenUserId);
			const names = data?.map((f) => f.name) ?? [];
			expect(names).toContain("preview-int-test.docx");
			expect(names).not.toContain("preview-int-test.pdf");

			spy.mockRestore();
		}, 20_000);
	});
});
