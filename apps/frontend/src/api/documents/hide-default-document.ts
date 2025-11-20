import { supabase } from "../../../supabase-client";
import { useAuthStore } from "../../store/auth-store";

export async function hideDefaultDocument(
	documentId: number,
): Promise<Error | null> {
	const { session } = useAuthStore.getState();
	if (!session?.user.id) {
		return new Error("No user session");
	}

	const { error } = await supabase
		.from("user_hidden_default_documents")
		.insert({
			user_id: session.user.id,
			document_id: documentId,
		});

	if (error) {
		return new Error(error.message);
	}

	return null;
}
