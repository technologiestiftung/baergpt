import { create } from "zustand";
import type { Document, UserDocument, UserFolder } from "../common";
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

	selectedUserChatFolders: UserFolder[];
	selectUserChatFolder: (folder: UserFolder) => void;
	unselectUserChatFolder: (folderId: number) => void;
	toggleUserChatFolder: (folder: UserFolder) => void;
	getSelectedUserChatFolderIds: () => number[];

	selectedUserFoldersForAction: UserFolder[];
	selectUserFolderForAction: (folder: UserFolder) => void;
	selectAllItemsForActionInCurrentFolder: () => void;
	unselectFolderForAction: (folderId: number) => void;
	unselectAllItemsForActionInCurrentFolder: () => void;

	getUserDocumentsInUserFolder: (folderId: number) => UserDocument[];
	getUserItemsInCurrentFolder: () => (UserFolder | UserDocument)[];
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
		const documents = get().getUserDocumentsInUserFolder(folderId);

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

		const {
			userFolders,
			selectedUserChatFolders,
			selectedUserFoldersForAction,
		} = get();

		const updatedFolders = userFolders.filter(({ id }) => id !== folderId);
		const updatedSelectedChatFolders = selectedUserChatFolders.filter(
			({ id }) => id !== folderId,
		);
		const updatedSelectedFoldersForAction = selectedUserFoldersForAction.filter(
			({ id }) => id !== folderId,
		);

		set(() => ({
			userFolders: updatedFolders,
			selectedUserChatFolders: updatedSelectedChatFolders,
			selectedUserFoldersForAction: updatedSelectedFoldersForAction,
		}));
	},

	selectedUserChatFolders: [],
	selectUserChatFolder: (folder) => {
		set(({ selectedUserChatFolders }) => ({
			selectedUserChatFolders: [...selectedUserChatFolders, folder],
		}));
	},
	unselectUserChatFolder: (folderId) => {
		set(({ selectedUserChatFolders }) => ({
			selectedUserChatFolders: selectedUserChatFolders.filter(
				({ id }) => id !== folderId,
			),
		}));
	},
	toggleUserChatFolder: (folder) => {
		const {
			selectedUserChatFolders,
			selectUserChatFolder,
			unselectUserChatFolder,
		} = get();
		const isSelected = selectedUserChatFolders.some(
			(fol) => fol.id === folder.id,
		);

		if (isSelected) {
			unselectUserChatFolder(folder.id);
			return;
		}

		selectUserChatFolder(folder);
	},
	getSelectedUserChatFolderIds: () =>
		get().selectedUserChatFolders.map(({ id }) => id),

	selectedUserFoldersForAction: [],
	selectUserFolderForAction: (folder) => {
		const { selectedUserFoldersForAction } = get();

		/**
		 * Folders can be selected by two ways:
		 * - by clicking on the item checkbox
		 * - by clicking on the select all checkbox
		 * Therefore we need to prevent multi selections
		 */
		const isFolderAlreadySelected = selectedUserFoldersForAction.some(
			({ id }) => id === folder.id,
		);
		if (isFolderAlreadySelected) {
			return;
		}

		set(() => ({
			selectedUserFoldersForAction: [...selectedUserFoldersForAction, folder],
		}));
	},
	selectAllItemsForActionInCurrentFolder: () => {
		const { getUserItemsInCurrentFolder, selectUserFolderForAction } = get();

		const items = getUserItemsInCurrentFolder();

		for (const item of items) {
			if (isDocument(item)) {
				useUserDocumentStore.getState().selectUserDocumentForAction(item);
			} else {
				selectUserFolderForAction(item);
			}
		}
	},

	unselectFolderForAction: (folderId) => {
		set(({ selectedUserFoldersForAction }) => ({
			selectedUserFoldersForAction: selectedUserFoldersForAction.filter(
				({ id }) => id !== folderId,
			),
		}));
	},
	unselectAllItemsForActionInCurrentFolder: () => {
		const { getUserItemsInCurrentFolder, unselectFolderForAction } = get();

		const items = getUserItemsInCurrentFolder();

		for (const item of items) {
			if (isDocument(item)) {
				useUserDocumentStore.getState().unselectUserDocumentForAction(item.id);
			} else {
				unselectFolderForAction(item.id);
			}
		}
	},

	getUserDocumentsInUserFolder: (folderId: number) => {
		const { userDocuments } = useUserDocumentStore.getState();
		return userDocuments.filter((doc) => doc.folder_id === folderId);
	},

	getUserItemsInCurrentFolder: () => {
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
