import { supabase } from "../../../supabase-client";

const RENAME_DOCUMENT_TIMEOUT_MS = 15_000;

export async function renameDocument(
	documentId: number,
	newName: string,
): Promise<void> {
	const { error: renameDocumentError } = await supabase
		.from("documents")
		.update({ file_name: newName })
		.eq("id", documentId)
		.select("id")
		.abortSignal(AbortSignal.timeout(RENAME_DOCUMENT_TIMEOUT_MS))
		.single();

	if (renameDocumentError) {
		throw renameDocumentError;
	}
}
