import { supabase } from "../../../supabase-client";

export async function deleteDocument(documentId: number): Promise<void> {
	const { error } = await supabase.rpc("delete_document_and_update_count", {
		document_id: documentId,
	});
	if (error) {
		console.error(error);
	}
}
