import { create } from "zustand";
import type { Document, UserFolder } from "../common";
import { getFolders } from "../api/folders/get-folders";
import { deleteFolder } from "../api/folders/delete-folder";
import { useUserDocumentStore } from "./use-user-document-store.ts";
import { createFolder } from "../api/folders/create-folder.ts";
import { isDocument } from "../components/documents/document-list/list-item/utils/is-document.ts";
import { useCurrentFolderStore } from "./use-current-folder-store.ts";

interface UserFolderStore {
	userFolders: UserFolder[];
	isUserFolderFirstLoad: boolean;
	getUserFolders: (signal: AbortSignal) => Promise<void>;
	createUserFolder: (folderName: string) => Promise<void>;
	deleteUserFolder: (folderId: number) => Promise<void>;

	selectedChatFolders: UserFolder[];
	selectChatFolder: (folder: UserFolder) => void;
	unselectChatFolder: (folderId: number) => void;
	toggleChatFolder: (folder: UserFolder) => void;
	getSelectedChatFolderIds: () => number[];

	selectedFoldersForAction: UserFolder[];
	selectFolderForAction: (folder: UserFolder) => void;
	selectAllItemsInCurrentFolder: () => void;
	unselectFolderForAction: (folderId: number) => void;
	unselectAllItemsInCurrentFolder: () => void;

	getDocumentsInFolder: (folderId: number) => Document[];
	getItemsInCurrentFolder: () => (UserFolder | Document)[];
}

export const useUserFolderStore = create<UserFolderStore>((set, get) => ({
	userFolders: [],
	isUserFolderFirstLoad: true,
	getUserFolders: async (signal: AbortSignal) => {
		try {
			const folders = await getFolders(signal);
			set({ userFolders: folders });
		} finally {
			if (get().isUserFolderFirstLoad) {
				set({ isUserFolderFirstLoad: false });
			}
		}
	},
	createUserFolder: async (folderName: string) => {
		await createFolder(folderName);
		await get().getUserFolders(new AbortController().signal);
	},

	deleteUserFolder: async (folderId: number) => {
		const documents = get().getDocumentsInFolder(folderId);

		let hasDocumentDeleteError = false;

		// Delete each document in the folder
		if (documents.length > 0) {
			for (const document of documents) {
				const error = await useUserDocumentStore
					.getState()
					.deleteUserDocument(document.id);
				if (error) {
					hasDocumentDeleteError = true;
				}
			}
		}

		if (hasDocumentDeleteError) {
			return;
		}

		await deleteFolder(folderId);

		const { userFolders, selectedChatFolders, selectedFoldersForAction } =
			get();

		const updatedFolders = userFolders.filter(({ id }) => id !== folderId);
		const updatedSelectedChatFolders = selectedChatFolders.filter(
			({ id }) => id !== folderId,
		);
		const updatedSelectedFoldersForAction = selectedFoldersForAction.filter(
			({ id }) => id !== folderId,
		);

		set(() => ({
			userFolders: updatedFolders,
			selectedChatFolders: updatedSelectedChatFolders,
			selectedFoldersForAction: updatedSelectedFoldersForAction,
		}));
	},

	selectedChatFolders: [],
	selectChatFolder: (folder) => {
		set(({ selectedChatFolders }) => ({
			selectedChatFolders: [...selectedChatFolders, folder],
		}));
	},
	unselectChatFolder: (folderId) => {
		set(({ selectedChatFolders }) => ({
			selectedChatFolders: selectedChatFolders.filter(
				({ id }) => id !== folderId,
			),
		}));
	},
	toggleChatFolder: (folder) => {
		const { selectedChatFolders, selectChatFolder, unselectChatFolder } = get();
		const isSelected = selectedChatFolders.some((fol) => fol.id === folder.id);

		if (isSelected) {
			unselectChatFolder(folder.id);
			return;
		}

		selectChatFolder(folder);
	},
	getSelectedChatFolderIds: () => get().selectedChatFolders.map(({ id }) => id),

	selectedFoldersForAction: [],
	selectFolderForAction: (folder) => {
		const { selectedFoldersForAction } = get();

		/**
		 * Folders can be selected by two ways:
		 * - by clicking on the item checkbox
		 * - by clicking on the select all checkbox
		 * Therefore we need to prevent multi selections
		 */
		const isFolderAlreadySelected = selectedFoldersForAction.some(
			({ id }) => id === folder.id,
		);
		if (isFolderAlreadySelected) {
			return;
		}

		set(() => ({
			selectedFoldersForAction: [...selectedFoldersForAction, folder],
		}));
	},
	selectAllItemsInCurrentFolder: () => {
		const { getItemsInCurrentFolder, selectFolderForAction } = get();

		const items = getItemsInCurrentFolder();

		for (const item of items) {
			if (isDocument(item)) {
				useUserDocumentStore.getState().selectUserDocumentForAction(item);
			} else {
				selectFolderForAction(item);
			}
		}
	},

	unselectFolderForAction: (folderId) => {
		set(({ selectedFoldersForAction }) => ({
			selectedFoldersForAction: selectedFoldersForAction.filter(
				({ id }) => id !== folderId,
			),
		}));
	},
	unselectAllItemsInCurrentFolder: () => {
		const { getItemsInCurrentFolder, unselectFolderForAction } = get();

		const items = getItemsInCurrentFolder();

		for (const item of items) {
			if (isDocument(item)) {
				useUserDocumentStore.getState().unselectUserDocumentForAction(item.id);
			} else {
				unselectFolderForAction(item.id);
			}
		}
	},

	getDocumentsInFolder: (folderId: number) => {
		const { userDocuments } = useUserDocumentStore.getState();
		return userDocuments.filter((doc) => doc.folder_id === folderId);
	},

	getItemsInCurrentFolder: () => {
		const { userFolders } = get();
		const { currentFolder } = useCurrentFolderStore.getState();
		const { userDocuments, deletedDefaultDocumentIds } =
			useUserDocumentStore.getState();
		const isNotDeletedDefault = (doc: Document) =>
			!deletedDefaultDocumentIds.includes(doc.id);

		if (!currentFolder) {
			const documentsInCurrentFolder = userDocuments
				.filter(({ folder_id }) => folder_id === null)
				.filter(isNotDeletedDefault);
			return [...userFolders, ...documentsInCurrentFolder];
		}

		return userDocuments
			.filter(({ folder_id }) => folder_id === currentFolder.id)
			.filter(isNotDeletedDefault);
	},
}));
