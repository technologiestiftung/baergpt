import { create } from "zustand";
import type { UserFolder, PublicFolder } from "../common";
import { useUserDocumentStore } from "./use-user-document-store.ts";
import { useUserFolderStore } from "./use-user-folder-store.ts";

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
		const { selectedFoldersForAction, unselectFolderForAction } =
			useUserFolderStore.getState();
		selectedFoldersForAction.forEach(({ id }) => unselectFolderForAction(id));

		const { selectedUserDocumentsForAction, unselectUserDocumentForAction } =
			useUserDocumentStore.getState();
		selectedUserDocumentsForAction.forEach(({ id }) =>
			unselectUserDocumentForAction(id),
		);
	},
}));
