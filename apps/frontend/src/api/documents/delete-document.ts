import { supabase } from "../../../supabase-client";
import { useErrorStore } from "../../store/error-store";

export async function deleteDocument(
	documentId: number,
): Promise<Error | null> {
	const { handleError } = useErrorStore.getState();
	const { error: supabaseError } = await supabase.rpc(
		"delete_document_and_update_count",
		{
			document_id: documentId,
		},
	);

	if (supabaseError) {
		const error = new Error(supabaseError.message);
		handleError(error);
		return error;
	}

	return null;
}
