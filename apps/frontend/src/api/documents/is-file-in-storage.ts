import { supabase } from "../../../supabase-client.ts";

export async function isFileInStorage(filePath: string) {
	return supabase.storage.from("documents").exists(filePath);
}
