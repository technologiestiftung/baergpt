import { supabase } from "../../../supabase-client";
import { useErrorStore } from "../../store/error-store.ts";

export async function updateDocumentFolder(
	documentId: number,
	folderId: number | null,
): Promise<void> {
	const { error } = await supabase
		.from("documents")
		.update({ folder_id: folderId })
		.eq("id", documentId);

	if (error) {
		useErrorStore.getState().handleError(error);
		throw error;
	}
}
