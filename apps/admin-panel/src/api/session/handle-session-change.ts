import { useUserStore } from "../../store/use-user-store.ts";
import type { Session } from "@supabase/supabase-js";
import { useDocumentStore } from "../../store/use-document-store.ts";
import { useAccessGroupStore } from "@/store/use-access-group-store.ts";

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
			useUserStore.getState().getUser(signal),
			useDocumentStore.getState().getDocuments(signal),
		];

		await useUserStore.getState().checkIsUserAdmin(signal);
		// fetch users and access group only if user is admin
		if (useUserStore.getState().isUserAdmin) {
			promises.push(useUserStore.getState().getUsers(signal));
			promises.push(useAccessGroupStore.getState().getAccessGroupId(signal));
		}

		await Promise.all(promises);
	} catch (error) {
		console.error("Error during session change handling:", error);
	}
}
