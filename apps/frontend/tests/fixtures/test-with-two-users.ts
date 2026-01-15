import { Session } from "@supabase/supabase-js";
import { test as baseTest } from "@playwright/test";
import { supabaseAdminClient, supabaseAnonClient } from "../supabase.ts";
import {
	defaultUserFirstName,
	defaultUserLastName,
	defaultUserPassword,
} from "../constants.ts";

export type UserAccount = {
	email: string;
	password: string;
	id: string;
};

export type TwoUserTestFixtures = {
	primaryAccount: UserAccount;
	primarySession: Session;
	secondaryAccount: UserAccount;
	secondarySession: Session;
};

/**
 * Creates a user with the given email prefix and returns the account details.
 */
async function createUser(emailPrefix: string): Promise<UserAccount> {
	const email = `${emailPrefix}@local.berlin.de`;

	const { data, error: createUserError } =
		await supabaseAdminClient.auth.admin.createUser({
			email,
			password: defaultUserPassword,
			email_confirm: true,
			user_metadata: {
				first_name: defaultUserFirstName,
				last_name: defaultUserLastName,
			},
		});

	baseTest.expect(createUserError).toBeNull();
	baseTest.expect(data).toBeDefined();

	if (createUserError) {
		throw new Error(`Failed to create user: ${createUserError.message}`);
	}

	const id = data.user.id;

	const { error: activationError } = await supabaseAdminClient
		.from("user_active_status")
		.update({ registration_finished_at: new Date().toISOString() })
		.eq("id", id);

	baseTest.expect(activationError).toBeNull();

	return { email, password: defaultUserPassword, id };
}

/**
 * Signs in a user and returns their session.
 */
async function signInUser(account: UserAccount): Promise<Session> {
	const { data, error } = await supabaseAnonClient.auth.signInWithPassword({
		email: account.email,
		password: account.password,
	});

	baseTest.expect(error).toBeNull();
	baseTest.expect(data).toBeDefined();

	if (error) {
		throw new Error(`Failed to sign in: ${error.message}`);
	}

	return data.session;
}

/**
 * Cleans up a user and their associated data.
 */
async function cleanupUser(id: string) {
	// Delete user's documents
	const { error: deleteDocumentsError } = await supabaseAdminClient
		.from("documents")
		.delete()
		.eq("owned_by_user_id", id);

	if (deleteDocumentsError) {
		console.error(
			`Failed to delete documents for user ${id}:`,
			deleteDocumentsError,
		);
	}

	// Delete user's document chunks
	const { error: deleteDocumentChunksError } = await supabaseAdminClient
		.from("document_chunks")
		.delete()
		.eq("owned_by_user_id", id);

	if (deleteDocumentChunksError) {
		console.error(
			`Failed to delete document chunks for user ${id}:`,
			deleteDocumentChunksError,
		);
	}

	// Delete user's document summaries
	const { error: deleteDocumentSummariesError } = await supabaseAdminClient
		.from("document_summaries")
		.delete()
		.eq("owned_by_user_id", id);

	if (deleteDocumentSummariesError) {
		console.error(
			`Failed to delete document summaries for user ${id}:`,
			deleteDocumentSummariesError,
		);
	}

	// Delete user's folders
	const { error: deleteFoldersError } = await supabaseAdminClient
		.from("document_folders")
		.delete()
		.eq("user_id", id);

	if (deleteFoldersError) {
		console.error(
			`Failed to delete folders for user ${id}:`,
			deleteFoldersError,
		);
	}

	// Delete user's storage files
	const { data: storageFiles, error: listError } =
		await supabaseAdminClient.storage.from("documents").list(`${id}`);

	if (!listError && storageFiles && storageFiles.length > 0) {
		const filesToRemove = storageFiles.map((file) => `${id}/${file.name}`);
		const { error: removeError } = await supabaseAdminClient.storage
			.from("documents")
			.remove(filesToRemove);

		if (removeError) {
			console.error(
				`Failed to remove storage files for user ${id}:`,
				removeError,
			);
		}
	}

	// Delete the user
	const { error: deleteUserError } =
		await supabaseAdminClient.auth.admin.deleteUser(id);

	if (deleteUserError?.message !== "User not found") {
		if (deleteUserError) {
			console.error(`Failed to delete user ${id}:`, deleteUserError);
		}
	}
}

/**
 * A test fixture that provides two separate user accounts with their sessions.
 * Use this for testing storage policies and access control between users.
 */
export const testWithTwoUsers = baseTest.extend<TwoUserTestFixtures>({
	primaryAccount: [
		async ({}, use) => {
			const account = await createUser("primary.user");
			await use(account);
			await cleanupUser(account.id);
		},
		{ scope: "test" },
	],

	primarySession: [
		async ({ primaryAccount }, use) => {
			const session = await signInUser(primaryAccount);
			await use(session);
		},
		{ scope: "test" },
	],

	secondaryAccount: [
		async ({}, use) => {
			const account = await createUser("secondary.user");
			await use(account);
			await cleanupUser(account.id);
		},
		{ scope: "test" },
	],

	secondarySession: [
		async ({ secondaryAccount }, use) => {
			const session = await signInUser(secondaryAccount);
			await use(session);
		},
		{ scope: "test" },
	],
});
