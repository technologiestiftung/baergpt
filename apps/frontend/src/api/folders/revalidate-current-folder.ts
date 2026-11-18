import { useCurrentFolderStore } from "../../store/use-current-folder-store.ts";
import { useUserFolderStore } from "../../store/use-user-folder-store.ts";
import { isUserFolder } from "../../components/documents/document-list/list-item/utils/is-user-folder.ts";

/**
 * The current folder may have been deleted elsewhere (e.g. in another tab).
 * Checks it against the already-fetched folder list. If it's gone, resets
 * the current folder to the main file collection.
 *
 * Callers must refresh the folder list (getUserFolders) immediately before
 * calling this, so the check can be done in-memory instead of a second
 * network request.
 *
 * Returns true if the current folder was gone and has been reset.
 */
export function revalidateCurrentFolder(): boolean {
	const { currentFolder, setCurrentFolder } = useCurrentFolderStore.getState();
	if (!currentFolder || !isUserFolder(currentFolder)) {
		return false;
	}

	const { userFolders } = useUserFolderStore.getState();
	const stillExists = userFolders.some(
		(folder) => folder.id === currentFolder.id,
	);
	if (stillExists) {
		return false;
	}

	setCurrentFolder(null);
	return true;
}
