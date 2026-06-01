import { create } from "zustand";
import type { UserFolder, PublicFolder } from "../common";
import { useUserDocumentStore } from "./use-user-document-store.ts";
import { useUserFolderStore } from "./use-user-folder-store.ts";
import { isUserFolder } from "../components/documents/document-list/list-item/utils/is-user-folder.ts";
import { useDocumentsListStore } from "./use-documents-list-store.ts";

interface CurrentFolderStore {
	currentFolder: UserFolder | PublicFolder | null;
	setCurrentFolder: (folder: UserFolder | PublicFolder | null) => void;
}

export const useCurrentFolderStore = create<CurrentFolderStore>((set) => ({
	currentFolder: null,
	setCurrentFolder: (folder) => {
		set({ currentFolder: folder });

		/**
		 * Reset selected folders and documents for action when changing the folder
		 */
		const { selectedUserFoldersForAction, unselectFolderForAction } =
			useUserFolderStore.getState();
		selectedUserFoldersForAction.forEach(({ id }) =>
			unselectFolderForAction(id),
		);

		const { selectedUserDocumentsForAction, unselectUserDocumentForAction } =
			useUserDocumentStore.getState();
		selectedUserDocumentsForAction.forEach(({ id }) =>
			unselectUserDocumentForAction(id),
		);

		const { isMultiSelectForActionVisible } = useDocumentsListStore.getState();
		const multiSelectIsAllowed = folder === null || isUserFolder(folder);
		if (isMultiSelectForActionVisible && !multiSelectIsAllowed) {
			useDocumentsListStore.getState().hideMultiSelectForAction();
		}
	},
}));
