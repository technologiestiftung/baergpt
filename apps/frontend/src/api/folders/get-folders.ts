import { supabase } from "../../../supabase-client";
import type { UserFolder } from "../../common";
import { useErrorStore } from "../../store/error-store.ts";

export async function getFolders(signal: AbortSignal): Promise<UserFolder[]> {
	const { data, error } = await supabase
		.from("document_folders")
		.select("*")
		.abortSignal(signal);

	if (signal.aborted) {
		return [];
	}

	if (error) {
		useErrorStore.getState().handleError(error);
		return [];
	}

	return data ?? [];
}
