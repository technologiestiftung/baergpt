import { supabaseAdminClient } from "./supabase.ts";
import { mockDocumentUpload } from "./fixtures/test-with-documents.ts";
import {
	defaultDocumentPath,
	defaultUserPassword,
	seedDefaultDocumentName,
	seedPublicDocumentName,
} from "./constants.ts";
import { findUserByEmail } from "./fixtures/test-with-registered-user.ts";

/**
 * Runs once before the whole test run. Seeds the shared "Alle" access-group
 * documents (default + public) a single time so parallel tests never race on
 * the old per-test, non-atomic "seed if necessary" checks, and so per-user
 * cleanup never deletes them mid-run. The docs are owned by a dedicated seed
 * user (never a test user), so nothing cleans them up between tests.
 */
export default async function globalSetup() {
	const seedUserId = await ensureSeedUser();

	await ensureAccessGroupDocument({
		seedUserId,
		fileName: seedDefaultDocumentName,
		sourceType: "default_document",
	});
	await ensureAccessGroupDocument({
		seedUserId,
		fileName: seedPublicDocumentName,
		sourceType: "public_document",
	});
}

const SEED_USER_EMAIL = "e2e-seed-user@ts.berlin";

/** Creates (or reuses) a persistent user that owns the shared seed documents. */
async function ensureSeedUser(): Promise<string> {
	const existing = await findUserByEmail(SEED_USER_EMAIL);
	if (existing) {
		return existing.id;
	}

	const { data, error } = await supabaseAdminClient.auth.admin.createUser({
		email: SEED_USER_EMAIL,
		password: defaultUserPassword,
		email_confirm: true,
	});
	if (error || !data.user) {
		throw new Error(
			`Failed to create seed user: ${error?.message ?? "unknown error"}`,
		);
	}
	return data.user.id;
}

async function ensureAccessGroupDocument({
	seedUserId,
	fileName,
	sourceType,
}: {
	seedUserId: string;
	fileName: string;
	sourceType: "default_document" | "public_document";
}) {
	const { count, error } = await supabaseAdminClient
		.from("documents")
		.select("id", { count: "exact", head: true })
		.eq("source_type", sourceType)
		.eq("file_name", fileName);

	if (error) {
		throw new Error(`Failed to check for ${fileName}: ${error.message}`);
	}

	if (count && count > 0) {
		return;
	}

	const { data: accessGroup, error: accessGroupError } =
		await supabaseAdminClient
			.from("access_groups")
			.select("id")
			.eq("name", "Alle")
			.single();

	if (accessGroupError || !accessGroup) {
		throw new Error(
			`Default access group 'Alle' not found: ${accessGroupError?.message ?? ""}`,
		);
	}

	await mockDocumentUpload({
		userId: seedUserId,
		// Access-group uploads use the admin client for storage; no token needed.
		accessToken: "",
		accessGroupId: accessGroup.id,
		fileName,
		filePath: defaultDocumentPath,
		sourceType,
		bucketName: "public_documents",
	});
}
