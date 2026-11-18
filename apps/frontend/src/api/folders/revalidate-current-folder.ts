import { supabase } from "../../../supabase-client";
import { useCurrentFolderStore } from "../../store/use-current-folder-store.ts";
import { useUserFolderStore } from "../../store/use-user-folder-store.ts";
import { isUserFolder } from "../../components/documents/document-list/list-item/utils/is-user-folder.ts";

/**
 * The current folder may have been deleted elsewhere (e.g. in another tab).
 * Checks that it still exists. If not, resets the current folder to the main
 * file collection and refreshes the folder list.
 *
 * Returns true if the current folder was gone and has been reset.
 */
export async function revalidateCurrentFolder(): Promise<boolean> {
	const { currentFolder, setCurrentFolder } = useCurrentFolderStore.getState();
	if (!currentFolder || !isUserFolder(currentFolder)) {
		return false;
	}

	const { data, error } = await supabase
		.from("document_folders")
		.select("id")
		.eq("id", currentFolder.id)
		.maybeSingle();

	// On errors keep the folder, the backend still falls back safely.
	if (error || data) {
		return false;
	}

	// The user may have navigated while the request was running.
	if (useCurrentFolderStore.getState().currentFolder?.id !== currentFolder.id) {
		return false;
	}

	setCurrentFolder(null);
	await useUserFolderStore
		.getState()
		.getUserFolders(new AbortController().signal);
	return true;
}
