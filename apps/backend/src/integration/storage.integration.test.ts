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
import { serviceRoleDbClient as supabaseAdminClient } from "../supabase";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@repo/db-schema";
import { config } from "../config";
import { readFileSync } from "node:fs";

const supabaseAnonClient = createClient<Database>(
	config.supabaseUrl,
	config.supabaseAnonKey,
);

/**
 * Helper to upload a file directly to storage (without document table metadata).
 * Used for testing storage policies in isolation.
 */
async function uploadTestFile({
	client,
	userId,
	fileName,
	filePath,
}: {
	client: ReturnType<typeof createClient<Database>>;
	userId: string;
	fileName: string;
	filePath: string;
}) {
	const file = new Uint8Array(readFileSync(filePath));
	const storagePath = `${userId}/${fileName}`;

	const { error } = await client.storage
		.from("documents")
		.upload(
			storagePath,
			new File([file], fileName, { type: "application/pdf" }),
		);

	return { storagePath, error };
}

/**
 * Helper to clean up storage files for a user (without document table cleanup).
 */
async function cleanupStorageFiles(userId: string) {
	const { data: files } = await supabaseAdminClient.storage
		.from("documents")
		.list(userId);

	if (files && files.length > 0) {
		const filesToRemove = files.map((file) => `${userId}/${file.name}`);
		await supabaseAdminClient.storage.from("documents").remove(filesToRemove);
	}
}

describe("Integration tests for Storage", async () => {
	const givenAdminId = "d279dcb8-ec47-410b-acfc-6d8fdf8a4d85";
	const givenAdminEmail = "storage-test-suite-admin@local.berlin.de";
	const givenAdminPassword = "SecurePassword123!";

	const givenUserId = "90ed8ecb-6d80-4369-bf80-04f973333a47";
	const givenUserEmail = "storage-test-suite-user@local.berlin.de";
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
				userEmail: givenAdminEmail,
				userPassword: givenAdminPassword,
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
				userEmail: givenAdminEmail,
				userPassword: givenAdminPassword,
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
				.download(`${accessGroupId}/${defaultDocumentName}`);

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
				.download(`${accessGroupId}/${defaultDocumentName}`);

			expect(downloadError).toBeNull();
			expect(data).not.toBeNull();
		});

		it("should allow a non-authenticated user to download a public file", async () => {
			const { data, error: downloadError } = await supabaseAnonClient.storage
				.from("public_documents")
				.download(`${accessGroupId}/${defaultDocumentName}`);

			expect(downloadError).toBeNull();
			expect(data).not.toBeNull();
		});
	});

	describe("storage policies", () => {
		afterEach(async () => {
			await cleanupStorageFiles(givenAdminId);
			await cleanupStorageFiles(givenUserId);
		});

		describe("SELECT policy", () => {
			it("should forbid user to list another user's folder", async () => {
				// Admin uploads a file
				await supabaseAnonClient.auth.signInWithPassword({
					email: givenAdminEmail,
					password: givenAdminPassword,
				});

				const { error: uploadError } = await uploadTestFile({
					client: supabaseAnonClient,
					userId: givenAdminId,
					fileName: defaultDocumentName,
					filePath: defaultDocumentPath,
				});
				expect(uploadError).toBeNull();

				// User tries to list admin's folder
				await supabaseAnonClient.auth.signOut();
				await supabaseAnonClient.auth.signInWithPassword({
					email: givenUserEmail,
					password: givenUserPassword,
				});

				const { data: listData, error: listError } =
					await supabaseAnonClient.storage.from("documents").list(givenAdminId);

				// List succeeds but returns empty due to RLS filtering
				expect(listError).toBeNull();
				expect(listData).toEqual([]);
			});

			it("should forbid user to get signed URL for another user's file", async () => {
				// Admin uploads a file
				await supabaseAnonClient.auth.signInWithPassword({
					email: givenAdminEmail,
					password: givenAdminPassword,
				});

				const { storagePath, error: uploadError } = await uploadTestFile({
					client: supabaseAnonClient,
					userId: givenAdminId,
					fileName: defaultDocumentName,
					filePath: defaultDocumentPath,
				});
				expect(uploadError).toBeNull();

				// User tries to create signed URL for admin's file
				await supabaseAnonClient.auth.signOut();
				await supabaseAnonClient.auth.signInWithPassword({
					email: givenUserEmail,
					password: givenUserPassword,
				});

				const { data: signedUrlData, error: signedUrlError } =
					await supabaseAnonClient.storage
						.from("documents")
						.createSignedUrl(storagePath, 60);

				expect(signedUrlError).not.toBeNull();
				expect(signedUrlData).toBeNull();
			});
		});

		describe("INSERT policy", () => {
			it("should forbid user to upload a file to another user's folder", async () => {
				await supabaseAnonClient.auth.signInWithPassword({
					email: givenUserEmail,
					password: givenUserPassword,
				});

				// User tries to upload to admin's folder
				const { error: uploadError } = await uploadTestFile({
					client: supabaseAnonClient,
					userId: givenAdminId,
					fileName: "malicious_file.pdf",
					filePath: defaultDocumentPath,
				});

				expect(uploadError).not.toBeNull();
				expect(uploadError?.message).toMatch(
					/policy|permission|unauthorized|not allowed|violates/i,
				);
			});

			it("should allow user to upload a file to their own folder", async () => {
				await supabaseAnonClient.auth.signInWithPassword({
					email: givenUserEmail,
					password: givenUserPassword,
				});

				const { storagePath, error: uploadError } = await uploadTestFile({
					client: supabaseAnonClient,
					userId: givenUserId,
					fileName: defaultDocumentName,
					filePath: defaultDocumentPath,
				});

				expect(uploadError).toBeNull();

				// Verify file exists
				const { data, error: downloadError } = await supabaseAnonClient.storage
					.from("documents")
					.download(storagePath);

				expect(downloadError).toBeNull();
				expect(data).not.toBeNull();
			});
		});

		describe("UPDATE policy", () => {
			it("should forbid user to update another user's file", async () => {
				// Admin uploads a file
				await supabaseAnonClient.auth.signInWithPassword({
					email: givenAdminEmail,
					password: givenAdminPassword,
				});

				const { storagePath, error: uploadError } = await uploadTestFile({
					client: supabaseAnonClient,
					userId: givenAdminId,
					fileName: defaultDocumentName,
					filePath: defaultDocumentPath,
				});
				expect(uploadError).toBeNull();

				// User tries to update admin's file
				await supabaseAnonClient.auth.signOut();
				await supabaseAnonClient.auth.signInWithPassword({
					email: givenUserEmail,
					password: givenUserPassword,
				});

				const file = new Uint8Array(readFileSync(defaultDocumentPath));
				const { error: updateError } = await supabaseAnonClient.storage
					.from("documents")
					.update(
						storagePath,
						new File([file], defaultDocumentName, { type: "application/pdf" }),
						{ upsert: false },
					);

				expect(updateError).not.toBeNull();
			});

			it("should forbid user to move another user's file", async () => {
				// Admin uploads a file
				await supabaseAnonClient.auth.signInWithPassword({
					email: givenAdminEmail,
					password: givenAdminPassword,
				});

				const { storagePath, error: uploadError } = await uploadTestFile({
					client: supabaseAnonClient,
					userId: givenAdminId,
					fileName: defaultDocumentName,
					filePath: defaultDocumentPath,
				});
				expect(uploadError).toBeNull();

				// User tries to move admin's file to their folder
				await supabaseAnonClient.auth.signOut();
				await supabaseAnonClient.auth.signInWithPassword({
					email: givenUserEmail,
					password: givenUserPassword,
				});

				const { error: moveError } = await supabaseAnonClient.storage
					.from("documents")
					.move(storagePath, `${givenUserId}/stolen_file.pdf`);

				expect(moveError).not.toBeNull();
			});

			it("should allow user to update their own file", async () => {
				await supabaseAnonClient.auth.signInWithPassword({
					email: givenAdminEmail,
					password: givenAdminPassword,
				});

				const { storagePath, error: uploadError } = await uploadTestFile({
					client: supabaseAnonClient,
					userId: givenAdminId,
					fileName: defaultDocumentName,
					filePath: defaultDocumentPath,
				});
				expect(uploadError).toBeNull();

				// Admin updates their own file
				const file = new Uint8Array(readFileSync(defaultDocumentPath));
				const { error: updateError } = await supabaseAnonClient.storage
					.from("documents")
					.update(
						storagePath,
						new File([file], defaultDocumentName, { type: "application/pdf" }),
						{ upsert: false },
					);

				expect(updateError).toBeNull();
			});
		});

		describe("DELETE policy", () => {
			it("should forbid user to delete another user's file", async () => {
				// Admin uploads a file
				await supabaseAnonClient.auth.signInWithPassword({
					email: givenAdminEmail,
					password: givenAdminPassword,
				});

				const { storagePath, error: uploadError } = await uploadTestFile({
					client: supabaseAnonClient,
					userId: givenAdminId,
					fileName: defaultDocumentName,
					filePath: defaultDocumentPath,
				});
				expect(uploadError).toBeNull();

				// User tries to delete admin's file
				await supabaseAnonClient.auth.signOut();
				await supabaseAnonClient.auth.signInWithPassword({
					email: givenUserEmail,
					password: givenUserPassword,
				});

				// Note: Supabase storage.remove() doesn't return error for unauthorized delete,
				// but the file should still exist
				await supabaseAnonClient.storage
					.from("documents")
					.remove([storagePath]);

				// Verify file still exists by having admin download it
				await supabaseAnonClient.auth.signOut();
				await supabaseAnonClient.auth.signInWithPassword({
					email: givenAdminEmail,
					password: givenAdminPassword,
				});

				const { data: downloadData, error: downloadError } =
					await supabaseAnonClient.storage
						.from("documents")
						.download(storagePath);

				expect(downloadError).toBeNull();
				expect(downloadData).not.toBeNull();
			});

			it("should allow user to delete their own file", async () => {
				await supabaseAnonClient.auth.signInWithPassword({
					email: givenAdminEmail,
					password: givenAdminPassword,
				});

				const { storagePath, error: uploadError } = await uploadTestFile({
					client: supabaseAnonClient,
					userId: givenAdminId,
					fileName: defaultDocumentName,
					filePath: defaultDocumentPath,
				});
				expect(uploadError).toBeNull();

				// Admin deletes their own file
				const { error: deleteError } = await supabaseAnonClient.storage
					.from("documents")
					.remove([storagePath]);

				expect(deleteError).toBeNull();

				// Verify file no longer exists
				const { data: downloadData, error: downloadError } =
					await supabaseAnonClient.storage
						.from("documents")
						.download(storagePath);

				expect(downloadError).not.toBeNull();
				expect(downloadData).toBeNull();
			});
		});
	});
});
