import { supabase } from "../../../supabase-client";
import { useAuthStore } from "../../store/auth-store";

export async function getHiddenDefaultDocumentIds(): Promise<number[]> {
	const { session } = useAuthStore.getState();
	if (!session?.user.id) {
		return [];
	}

	const { data, error } = await supabase
		.from("user_hidden_default_documents")
		.select("document_id")
		.eq("user_id", session.user.id);

	if (error || !data) {
		return [];
	}

	return data.map((row: { document_id: number }) => row.document_id);
}
