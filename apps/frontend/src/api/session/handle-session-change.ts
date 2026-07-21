import { useUserDocumentStore } from "../../store/use-user-document-store.ts";
import { useUserFolderStore } from "../../store/use-user-folder-store.ts";
import { useChatsStore } from "../../store/use-chats-store.ts";
import { useUserStore } from "../../store/user-store.ts";
import { useAuthStore } from "../../store/auth-store.ts";
import type { Session } from "@supabase/supabase-js";
import { useErrorStore } from "../../store/error-store.ts";
import { useMaintenanceModeStore } from "../../store/use-maintenance-mode-store.ts";
import { usePublicDocumentsStore } from "../../store/use-public-documents-store.ts";

let abortController: null | AbortController = null;

export async function handleSessionChange(session: Session | null) {
	if (!session) {
		return;
	}

	if (abortController !== null) {
		abortController.abort();
	}

	abortController = new AbortController();
	const signal = abortController.signal;

	try {
		const promises = [
			useAuthStore.getState().checkIsUserBanned(),
			useUserFolderStore.getState().getUserFolders(signal),
			usePublicDocumentsStore.getState().getPublicDocuments(signal),
			useUserDocumentStore.getState().getUserDocuments(signal),
			useChatsStore.getState().getChatsFromDb(signal),
			useUserStore.getState().getUser(signal),
			useAuthStore.getState().checkIsUserAdmin(signal),
			useMaintenanceModeStore.getState().checkMaintenanceMode(signal),
		];

		await Promise.all(promises);
	} catch (error) {
		useErrorStore.getState().handleError(error);
	}
}
