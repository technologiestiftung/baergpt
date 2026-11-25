import { supabase } from "../../../supabase-client";
import { useErrorStore } from "../../store/error-store.ts";
import { useToastStore } from "../../store/use-toast-store.ts";
import Content from "../../content.ts";

const FOREIGN_KEY_VIOLATION = "23503";

export async function updateDocumentFolder(
	documentId: number,
	folderId: number | null,
): Promise<void> {
	const { error } = await supabase
		.from("documents")
		.update({ folder_id: folderId })
		.eq("id", documentId);

	if (!error) {
		return;
	}

	// The target folder was deleted elsewhere (e.g. another tab); fall back to
	// the main collection instead of surfacing a raw FK-violation error.
	if (folderId !== null && error.code === FOREIGN_KEY_VIOLATION) {
		const { error: fallbackError } = await supabase
			.from("documents")
			.update({ folder_id: null })
			.eq("id", documentId);

		if (!fallbackError) {
			useToastStore.getState().addInfo(Content["toast.upload.folderMissing"]);
			return;
		}

		useErrorStore.getState().handleError(fallbackError);
		throw fallbackError;
	}

	useErrorStore.getState().handleError(error);
	throw error;
}
