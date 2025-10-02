import {
	afterEach,
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "vitest";
import { cleanupDocuments, mockDocumentUpload } from "./fixtures/documents";
import { defaultDocumentName, defaultDocumentPath } from "./fixtures/constants";
import { supabase as supabaseAdminClient } from "../supabase";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@repo/db-schema";
import { config } from "../config";

const supabaseAnonClient = createClient<Database>(
	config.supabaseUrl,
	config.supabaseAnonKey,
);

describe("Integration tests for Storage", async () => {
	const givenAdminId = "d279dcb8-ec47-410b-acfc-6d8fdf8a4d85";
	const givenAdminEmail = "storage-test-suite-admin@berlin.de";
	const givenAdminPassword = "SecurePassword123!";

	const givenUserId = "90ed8ecb-6d80-4369-bf80-04f973333a47";
	const givenUserEmail = "storage-test-suite-user@berlin.de";
	const givenUserPassword = "SecurePassword123!";

	const {
		data: { id: accessGroupId },
	} = await supabaseAdminClient
		.from("access_groups")
		.select()
		.eq("name", "Alle")
		.single();

	const users = [
		{
			id: givenAdminId,
			email: givenAdminEmail,
			password: givenAdminPassword,
		},
		{ id: givenUserId, email: givenUserEmail, password: givenUserPassword },
	];

	beforeAll(async () => {
		for (const user of users) {
			const { error: signupError } =
				await supabaseAdminClient.auth.admin.createUser({
					id: user.id,
					email: user.email,
					password: user.password,
					email_confirm: true,
				});

			expect(signupError).toBeNull();
		}

		const { error: setAdminError } = await supabaseAdminClient
			.from("application_admins")
			.insert({ user_id: givenAdminId });

		expect(setAdminError).toBeNull();
	});

	afterEach(async () => {
		await supabaseAnonClient.auth.signOut();
	});

	afterAll(async () => {
		for (const { id } of users) {
			const { error: deleteError } =
				await supabaseAdminClient.auth.admin.deleteUser(id);
			expect(deleteError).toBeNull();
		}
	});

	describe("personal document", () => {
		beforeEach(async () => {
			await mockDocumentUpload({
				userId: givenAdminId,
				accessGroupId: null,
				fileName: defaultDocumentName,
				filePath: defaultDocumentPath,
				sourceType: "personal_document",
				bucketName: "documents",
			});
		});

		afterEach(async () => {
			await cleanupDocuments(givenAdminId);
		});

		it("should allow user to download a self-owned personal file", async () => {
			await supabaseAnonClient.auth.signInWithPassword({
				email: givenAdminEmail,
				password: givenAdminPassword,
			});

			const { data, error: downloadError } = await supabaseAnonClient.storage
				.from("documents")
				.download(`${givenAdminId}/${defaultDocumentName}`);

			expect(downloadError).toBeNull();
			expect(data).not.toBeNull();
		});

		it("should forbid a user to download a not self-owned personal file", async () => {
			await supabaseAnonClient.auth.signInWithPassword({
				email: givenUserEmail,
				password: givenUserPassword,
			});

			const { data, error: downloadError } = await supabaseAnonClient.storage
				.from("documents")
				.download(`${givenAdminId}/${defaultDocumentName}`);

			expect(downloadError).not.toBeNull();
			expect(data).toBeNull();
		});

		it("should forbid a non-authenticated user to download a personal file (self-owned or not)", async () => {
			const { data, error: downloadError } = await supabaseAnonClient.storage
				.from("documents")
				.download(`${givenAdminId}/${defaultDocumentName}`);

			expect(downloadError).not.toBeNull();
			expect(data).toBeNull();
		});
	});

	describe("public document", () => {
		beforeEach(async () => {
			await mockDocumentUpload({
				userId: givenAdminId,
				accessGroupId,
				fileName: defaultDocumentName,
				filePath: defaultDocumentPath,
				sourceType: "public_document",
				bucketName: "public_documents",
			});
		});

		afterEach(async () => {
			await cleanupDocuments(givenAdminId);
		});

		it("should allow default user to be able to download a public file", async () => {
			await supabaseAnonClient.auth.signInWithPassword({
				email: givenUserEmail,
				password: givenUserPassword,
			});

			const { data, error: downloadError } = await supabaseAnonClient.storage
				.from("public_documents")
				.download(`${givenAdminId}/${defaultDocumentName}`);

			expect(downloadError).toBeNull();
			expect(data).not.toBeNull();
		});

		it("should allow admin user to be able to download a public file", async () => {
			await supabaseAnonClient.auth.signInWithPassword({
				email: givenAdminEmail,
				password: givenAdminPassword,
			});

			const { data, error: downloadError } = await supabaseAnonClient.storage
				.from("public_documents")
				.download(`${givenAdminId}/${defaultDocumentName}`);

			expect(downloadError).toBeNull();
			expect(data).not.toBeNull();
		});

		it.fails(
			"should forbid a non-authenticated user to download a personal file (self-owned or not)",
			async () => {
				const { data, error: downloadError } = await supabaseAnonClient.storage
					.from("public_documents")
					.download(`${givenAdminId}/${defaultDocumentName}`);

				expect(downloadError).not.toBeNull();
				expect(data).toBeNull();
			},
		);
	});
});
