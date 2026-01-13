import {
	describe,
	it,
	expect,
	vi,
	beforeEach,
	beforeAll,
	afterAll,
} from "vitest";
import app from "../../index";
import { serviceRoleDbClient } from "../../supabase";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@repo/db-schema";
import { config } from "../../config";
import { GenerationService } from "../../services/generation-service";
import {
	defaultDocumentName,
	defaultDocumentPath,
} from "../fixtures/constants";
import { readFileSync } from "node:fs";
import { initQueues } from "../../services/distributed-limiter";

const supabaseAnonClient = createClient<Database>(
	config.supabaseUrl,
	config.supabaseAnonKey,
);

describe("Documents Route Integration", () => {
	const givenUserId = "d279dcb8-ec47-410b-acfc-6d8fdf8a4d85";
	const givenUserEmail = "docs-test-suite-user@local.berlin.de";
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

		await initQueues();
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

	it("should remove storage file if processing fails", async () => {
		// 1. Upload file to storage
		const sourceUrl = `${givenUserId}/${defaultDocumentName}`;
		const file = readFileSync(defaultDocumentPath);
		const { error: uploadError } = await supabaseAnonClient.storage
			.from("documents")
			.upload(sourceUrl, file, {
				contentType: "application/pdf",
				upsert: true,
			});
		expect(uploadError).toBeNull();

		// Verify it exists
		const { data: listBefore } = await serviceRoleDbClient.storage
			.from("documents")
			.list(givenUserId);
		expect(
			listBefore?.find((f) => f.name === defaultDocumentName),
		).toBeDefined();

		// 2. Mock GenerationService to fail
		// We use spyOn on the prototype because the service is instantiated inside the route module
		const summarizeSpy = vi
			.spyOn(GenerationService.prototype, "summarize")
			.mockRejectedValue(new Error("Forced Failure"));

		// 3. Call /process
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
			}),
		});

		const res = await app.fetch(req);
		expect(res.status).toBe(500);

		// 4. Verify file is gone

		const { data: listAfter } = await serviceRoleDbClient.storage
			.from("documents")
			.list(givenUserId);
		const found = listAfter?.find((f) => f.name === defaultDocumentName);
		expect(found).toBeUndefined();

		summarizeSpy.mockRestore();
	}, 30_000);
});
