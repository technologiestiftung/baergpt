import { supabase } from "../../../supabase-client";

export async function renameDocument(
	documentId: number,
	newName: string,
): Promise<void> {
	const { error: renameDocumentError } = await supabase
		.from("documents")
		.update({ file_name: newName })
		.eq("id", documentId)
		.select("id")
		.single();

	if (renameDocumentError) {
		throw renameDocumentError;
	}
}
