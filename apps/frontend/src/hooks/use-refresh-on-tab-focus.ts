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
		let isRefreshing = false;

		const refresh = async () => {
			if (document.visibilityState !== "visible" || isRefreshing) {
				return;
			}
			isRefreshing = true;
			try {
				const signal = new AbortController().signal;
				await Promise.all([
					useUserFolderStore.getState().getUserFolders(signal),
					useUserDocumentStore.getState().getUserDocuments(signal),
				]);
				await revalidateCurrentFolder();
			} catch (error) {
				captureError(error);
			} finally {
				isRefreshing = false;
			}
		};

		document.addEventListener("visibilitychange", refresh);
		window.addEventListener("focus", refresh);
		return () => {
			document.removeEventListener("visibilitychange", refresh);
			window.removeEventListener("focus", refresh);
		};
	}, []);
}
