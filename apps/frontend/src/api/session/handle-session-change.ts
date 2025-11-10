import { useDocumentStore } from "../../store/document-store.ts";
import { useFolderStore } from "../../store/folder-store.ts";
import { useChatsStore } from "../../store/use-chats-store.ts";
import { useUserStore } from "../../store/user-store.ts";
import { useAuthStore } from "../../store/auth-store.ts";
import type { Session } from "@supabase/supabase-js";
import { useIsActiveStore } from "../../store/use-is-active-store.ts";
import { useErrorStore } from "../../store/error-store.ts";
import { useMaintenanceModeStore } from "../../store/use-maintenance-mode-store.ts";

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
			useIsActiveStore.getState().getIsActive(signal),
			useIsActiveStore.getState().getAccountActivationTimestamp(),
			useFolderStore.getState().getFolders(signal),
			useDocumentStore.getState().getDocuments(signal),
			useDocumentStore.getState().getPublicDocuments(signal),
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
