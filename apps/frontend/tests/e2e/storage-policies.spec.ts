import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { testWithTwoUsers } from "../fixtures/test-with-two-users.ts";
import { config } from "../config.ts";
import type { Database } from "@repo/db-schema";
import { readFileSync } from "node:fs";
import { defaultDocumentName, defaultDocumentPath } from "../constants.ts";

/**
 * Creates a Supabase client authenticated with the given access token.
 */
function createAuthenticatedClient(accessToken: string) {
	return createClient<Database>(config.supabaseUrl, config.supabaseAnonKey, {
		global: { headers: { Authorization: `Bearer ${accessToken}` } },
	});
}

/**
 * Uploads a test file to storage using the given client.
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

test.describe("Storage Policies", () => {
	test.describe("SELECT policy", () => {
		testWithTwoUsers(
			"User cannot download another user's file",
			async ({ primaryAccount, primarySession, secondarySession }) => {
				const primaryClient = createAuthenticatedClient(
					primarySession.access_token,
				);
				const secondaryClient = createAuthenticatedClient(
					secondarySession.access_token,
				);

				// Primary user uploads a file
				const { storagePath, error: uploadError } = await uploadTestFile({
					client: primaryClient,
					userId: primaryAccount.id,
					fileName: defaultDocumentName,
					filePath: defaultDocumentPath,
				});

				expect(uploadError).toBeNull();

				// Secondary user tries to download primary user's file - should fail
				const { data: downloadData, error: downloadError } =
					await secondaryClient.storage.from("documents").download(storagePath);

				expect(downloadError).not.toBeNull();
				expect(downloadData).toBeNull();
			},
		);

		testWithTwoUsers(
			"User cannot list another user's folder",
			async ({ primaryAccount, primarySession, secondarySession }) => {
				const primaryClient = createAuthenticatedClient(
					primarySession.access_token,
				);
				const secondaryClient = createAuthenticatedClient(
					secondarySession.access_token,
				);

				// Primary user uploads a file
				const { error: uploadError } = await uploadTestFile({
					client: primaryClient,
					userId: primaryAccount.id,
					fileName: defaultDocumentName,
					filePath: defaultDocumentPath,
				});

				expect(uploadError).toBeNull();

				// Secondary user tries to list primary user's folder
				const { data: listData, error: listError } =
					await secondaryClient.storage
						.from("documents")
						.list(primaryAccount.id);

				// The list operation will succeed but return empty results
				// due to RLS filtering
				expect(listError).toBeNull();
				expect(listData).toEqual([]);
			},
		);

		testWithTwoUsers(
			"User cannot get signed URL for another user's file",
			async ({ primaryAccount, primarySession, secondarySession }) => {
				const primaryClient = createAuthenticatedClient(
					primarySession.access_token,
				);
				const secondaryClient = createAuthenticatedClient(
					secondarySession.access_token,
				);

				// Primary user uploads a file
				const { storagePath, error: uploadError } = await uploadTestFile({
					client: primaryClient,
					userId: primaryAccount.id,
					fileName: defaultDocumentName,
					filePath: defaultDocumentPath,
				});

				expect(uploadError).toBeNull();

				// Secondary user tries to create a signed URL for primary user's file
				const { data: signedUrlData, error: signedUrlError } =
					await secondaryClient.storage
						.from("documents")
						.createSignedUrl(storagePath, 60);

				// This should fail because the user doesn't have SELECT access
				expect(signedUrlError).not.toBeNull();
				expect(signedUrlData).toBeNull();
			},
		);

		testWithTwoUsers(
			"User can download their own file",
			async ({ primaryAccount, primarySession }) => {
				const primaryClient = createAuthenticatedClient(
					primarySession.access_token,
				);

				// Primary user uploads a file
				const { storagePath, error: uploadError } = await uploadTestFile({
					client: primaryClient,
					userId: primaryAccount.id,
					fileName: defaultDocumentName,
					filePath: defaultDocumentPath,
				});

				expect(uploadError).toBeNull();

				// Primary user downloads their own file - should succeed
				const { data: downloadData, error: downloadError } =
					await primaryClient.storage.from("documents").download(storagePath);

				expect(downloadError).toBeNull();
				expect(downloadData).not.toBeNull();
			},
		);
	});

	test.describe("INSERT policy", () => {
		testWithTwoUsers(
			"User cannot upload a file to another user's folder",
			async ({ primaryAccount, secondarySession }) => {
				const secondaryClient = createAuthenticatedClient(
					secondarySession.access_token,
				);

				// Secondary user tries to upload to primary user's folder
				const { error: uploadError } = await uploadTestFile({
					client: secondaryClient,
					userId: primaryAccount.id, // Trying to upload to primary user's folder
					fileName: "malicious_file.pdf",
					filePath: defaultDocumentPath,
				});

				expect(uploadError).not.toBeNull();
				// The error should indicate a policy violation or unauthorized access
				expect(uploadError?.message).toMatch(
					/policy|permission|unauthorized|not allowed|violates/i,
				);
			},
		);

		testWithTwoUsers(
			"User can upload a file to their own folder",
			async ({ secondaryAccount, secondarySession }) => {
				const secondaryClient = createAuthenticatedClient(
					secondarySession.access_token,
				);

				// Secondary user uploads to their own folder - should succeed
				const { storagePath, error: uploadError } = await uploadTestFile({
					client: secondaryClient,
					userId: secondaryAccount.id,
					fileName: defaultDocumentName,
					filePath: defaultDocumentPath,
				});

				expect(uploadError).toBeNull();

				// Verify the file exists
				const { data, error: downloadError } = await secondaryClient.storage
					.from("documents")
					.download(storagePath);

				expect(downloadError).toBeNull();
				expect(data).not.toBeNull();
			},
		);
	});

	test.describe("UPDATE policy", () => {
		testWithTwoUsers(
			"User cannot update another user's file",
			async ({ primaryAccount, primarySession, secondarySession }) => {
				const primaryClient = createAuthenticatedClient(
					primarySession.access_token,
				);
				const secondaryClient = createAuthenticatedClient(
					secondarySession.access_token,
				);

				// Primary user uploads a file
				const { storagePath, error: uploadError } = await uploadTestFile({
					client: primaryClient,
					userId: primaryAccount.id,
					fileName: defaultDocumentName,
					filePath: defaultDocumentPath,
				});

				expect(uploadError).toBeNull();

				// Secondary user tries to update (overwrite) primary user's file
				const file = new Uint8Array(readFileSync(defaultDocumentPath));
				const { error: updateError } = await secondaryClient.storage
					.from("documents")
					.update(
						storagePath,
						new File([file], defaultDocumentName, { type: "application/pdf" }),
						{ upsert: false },
					);

				expect(updateError).not.toBeNull();
			},
		);

		testWithTwoUsers(
			"User cannot move another user's file",
			async ({
				primaryAccount,
				primarySession,
				secondaryAccount,
				secondarySession,
			}) => {
				const primaryClient = createAuthenticatedClient(
					primarySession.access_token,
				);
				const secondaryClient = createAuthenticatedClient(
					secondarySession.access_token,
				);

				// Primary user uploads a file
				const { storagePath, error: uploadError } = await uploadTestFile({
					client: primaryClient,
					userId: primaryAccount.id,
					fileName: defaultDocumentName,
					filePath: defaultDocumentPath,
				});

				expect(uploadError).toBeNull();

				// Secondary user tries to move primary user's file to their own folder
				const { error: moveError } = await secondaryClient.storage
					.from("documents")
					.move(storagePath, `${secondaryAccount.id}/stolen_file.pdf`);

				expect(moveError).not.toBeNull();
			},
		);

		testWithTwoUsers(
			"User can update their own file",
			async ({ primaryAccount, primarySession }) => {
				const primaryClient = createAuthenticatedClient(
					primarySession.access_token,
				);

				// Primary user uploads a file
				const { storagePath, error: uploadError } = await uploadTestFile({
					client: primaryClient,
					userId: primaryAccount.id,
					fileName: defaultDocumentName,
					filePath: defaultDocumentPath,
				});

				expect(uploadError).toBeNull();

				// Primary user updates their own file
				const file = new Uint8Array(readFileSync(defaultDocumentPath));
				const { error: updateError } = await primaryClient.storage
					.from("documents")
					.update(
						storagePath,
						new File([file], defaultDocumentName, { type: "application/pdf" }),
						{ upsert: false },
					);

				expect(updateError).toBeNull();
			},
		);
	});

	test.describe("DELETE policy", () => {
		testWithTwoUsers(
			"User cannot delete another user's file",
			async ({ primaryAccount, primarySession, secondarySession }) => {
				const primaryClient = createAuthenticatedClient(
					primarySession.access_token,
				);
				const secondaryClient = createAuthenticatedClient(
					secondarySession.access_token,
				);

				// Primary user uploads a file
				const { storagePath, error: uploadError } = await uploadTestFile({
					client: primaryClient,
					userId: primaryAccount.id,
					fileName: defaultDocumentName,
					filePath: defaultDocumentPath,
				});

				expect(uploadError).toBeNull();

				// Secondary user tries to delete primary user's file
				const { error: deleteError } = await secondaryClient.storage
					.from("documents")
					.remove([storagePath]);

				expect(deleteError).toBeNull();

				// The delete operation does not return an error but does not actually delete the file
				// Let's verify the file still exists
				const { data: downloadData, error: downloadError } =
					await primaryClient.storage.from("documents").download(storagePath);

				// File should still exist and be downloadable by the owner
				expect(downloadError).toBeNull();
				expect(downloadData).not.toBeNull();
			},
		);

		testWithTwoUsers(
			"User can delete their own file",
			async ({ primaryAccount, primarySession }) => {
				const primaryClient = createAuthenticatedClient(
					primarySession.access_token,
				);

				// Primary user uploads a file
				const { storagePath, error: uploadError } = await uploadTestFile({
					client: primaryClient,
					userId: primaryAccount.id,
					fileName: defaultDocumentName,
					filePath: defaultDocumentPath,
				});

				expect(uploadError).toBeNull();

				// Primary user deletes their own file - should succeed
				const { error: deleteError } = await primaryClient.storage
					.from("documents")
					.remove([storagePath]);

				expect(deleteError).toBeNull();

				// Verify the file no longer exists
				const { data: downloadData, error: downloadError } =
					await primaryClient.storage.from("documents").download(storagePath);

				expect(downloadError).not.toBeNull();
				expect(downloadData).toBeNull();
			},
		);
	});
});
