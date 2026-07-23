import { supabase } from "../../../supabase-client";

export async function renameFolder(
	folderId: number,
	newName: string,
): Promise<void> {
	const { error: renameFolderError } = await supabase
		.from("document_folders")
		.update({ name: newName })
		.eq("id", folderId);

	if (renameFolderError) {
		throw renameFolderError;
	}
}
