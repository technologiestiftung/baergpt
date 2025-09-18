import { supabase } from "../../../supabase-client";

/**
 * Deletes a folder.
 */
export async function deleteFolder(folderId: number): Promise<void> {
	const { error: deleteFolderError } = await supabase
		.from("document_folders")
		.delete()
		.eq("id", folderId);

	if (deleteFolderError) {
		console.error("Error deleting folder:", deleteFolderError);
		throw deleteFolderError;
	}
}
