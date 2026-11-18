import { useEffect } from "react";
import { useUserFolderStore } from "../store/use-user-folder-store.ts";
import { useUserDocumentStore } from "../store/use-user-document-store.ts";
import { revalidateCurrentFolder } from "../api/folders/revalidate-current-folder.ts";
import { captureError } from "../monitoring/capture-error.ts";

/**
 * Folders and documents can be changed in another tab. When this tab becomes
 * visible again, reload both lists (so stale folders are no longer shown as
 * drop targets) and reset the current folder if it no longer exists.
 */
export function useRefreshOnTabFocus() {
	useEffect(() => {
		let controller: AbortController | null = null;

		const refresh = async () => {
			if (document.visibilityState !== "visible") {
				return;
			}
			// Abort a still-in-flight previous refresh instead of skipping this
			// one, so a superseded request doesn't land after a newer one.
			controller?.abort();
			controller = new AbortController();
			const { signal } = controller;
			try {
				await Promise.all([
					useUserFolderStore.getState().getUserFolders(signal),
					useUserDocumentStore.getState().getUserDocuments(signal),
				]);
				revalidateCurrentFolder();
			} catch (error) {
				captureError(error);
			}
		};

		document.addEventListener("visibilitychange", refresh);
		window.addEventListener("focus", refresh);
		return () => {
			controller?.abort();
			document.removeEventListener("visibilitychange", refresh);
			window.removeEventListener("focus", refresh);
		};
	}, []);
}
