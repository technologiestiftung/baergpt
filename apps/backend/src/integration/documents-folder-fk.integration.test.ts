import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { serviceRoleDbClient } from "../supabase";
import { file_size, num_pages, created_at } from "./fixtures/constants";

const USER_ID = "f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0";
const USER_EMAIL = "folder-fk-test@ts.berlin";
const DEAD_FOLDER_ID = 2_000_000_000;

function documentRow(folderId: number | null) {
	const id = crypto.randomUUID();
	return {
		owned_by_user_id: USER_ID,
		source_type: "personal_document" as const,
		source_url: `${USER_ID}/${id}.pdf`,
		file_name: `${id}.pdf`,
		file_checksum: id,
		file_size,
		num_pages,
		folder_id: folderId,
		created_at,
	};
}

describe("documents.folder_id foreign key", () => {
	beforeAll(async () => {
		const { error } = await serviceRoleDbClient.auth.admin.createUser({
			id: USER_ID,
			email: USER_EMAIL,
			email_confirm: true,
		});
		expect(error).toBeNull();
	});

	afterAll(async () => {
		await serviceRoleDbClient.auth.admin.deleteUser(USER_ID).catch(() => {});
	});

	it("rejects a document pointing at a folder that does not exist", async () => {
		const { error } = await serviceRoleDbClient
			.from("documents")
			.insert(documentRow(DEAD_FOLDER_ID));

		// 23503 = foreign_key_violation. This is what makes dropping a document
		// onto a stale (already deleted) folder impossible.
		expect(error?.code).toBe("23503");
	});

	it("rejects moving a document to a folder that does not exist", async () => {
		const { data: document, error: insertError } = await serviceRoleDbClient
			.from("documents")
			.insert(documentRow(null))
			.select("id")
			.single();
		expect(insertError).toBeNull();

		const { error } = await serviceRoleDbClient
			.from("documents")
			.update({ folder_id: DEAD_FOLDER_ID })
			.eq("id", document!.id);

		expect(error?.code).toBe("23503");
	});

	it("moves documents back to the main collection when their folder is deleted", async () => {
		const { data: folder, error: folderError } = await serviceRoleDbClient
			.from("document_folders")
			.insert({ user_id: USER_ID, name: "To be deleted" })
			.select("id")
			.single();
		expect(folderError).toBeNull();

		const { data: document, error: insertError } = await serviceRoleDbClient
			.from("documents")
			.insert(documentRow(folder!.id))
			.select("id, folder_id")
			.single();
		expect(insertError).toBeNull();
		expect(document!.folder_id).toBe(folder!.id);

		const { error: deleteError } = await serviceRoleDbClient
			.from("document_folders")
			.delete()
			.eq("id", folder!.id);
		expect(deleteError).toBeNull();

		const { data: after, error: selectError } = await serviceRoleDbClient
			.from("documents")
			.select("folder_id")
			.eq("id", document!.id)
			.single();
		expect(selectError).toBeNull();
		expect(after!.folder_id).toBeNull();
	});
});
