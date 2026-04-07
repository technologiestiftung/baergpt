import { supabase } from "../../../supabase-client.ts";

export async function deleteFileFromStorage(filePath: string) {
	return supabase.storage.from("documents").remove([filePath]);
}
