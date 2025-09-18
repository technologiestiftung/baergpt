import { supabase } from "../../../supabase-client";
import { useAuthStore } from "../../store/auth-store";

export async function createFolder(newFolderName: string): Promise<void> {
	const { error } = await supabase.from("document_folders").insert({
		name: newFolderName,
		created_at: new Date().toISOString(),
		user_id: useAuthStore.getState().session?.user.id,
	});

	if (error) {
		console.error("Error creating folder:", error);
		throw error;
	}
}
