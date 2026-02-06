import { create } from "zustand";
import type { Document, DocumentFolder } from "../common";
import { getFolders } from "../api/folders/get-folders";
import { deleteFolder } from "../api/folders/delete-folder";
import { useDocumentStore } from "./document-store.ts";
import { createFolder } from "../api/folders/create-folder.ts";
import { isDocument } from "../components/documents/document-list/list-item/utils/is-document.ts";

interface FolderStore {
	folders: DocumentFolder[];
	isFolderFirstLoad: boolean;
	getFolders: (signal: AbortSignal) => Promise<void>;
	createFolder: (folderName: string) => Promise<void>;
	deleteFolder: (folderId: number) => Promise<void>;

	currentFolder: DocumentFolder | null;
	setCurrentFolder: (folder: DocumentFolder | null) => void;

	selectedChatFolders: DocumentFolder[];
	selectChatFolder: (folder: DocumentFolder) => void;
	unselectChatFolder: (folderId: number) => void;
	getSelectedChatFolderIds: () => number[];

	selectedFoldersForAction: DocumentFolder[];
	selectFolderForAction: (folder: DocumentFolder) => void;
	selectAllItemsInCurrentFolder: () => void;
	unselectFolderForAction: (folderId: number) => void;
	unselectAllItemsInCurrentFolder: () => void;

	getDocumentsInFolder: (folderId: number) => Document[];
	getItemsInCurrentFolder: () => (DocumentFolder | Document)[];
}

export const useFolderStore = create<FolderStore>((set, get) => ({
	folders: [],
	isFolderFirstLoad: true,
	getFolders: async (signal: AbortSignal) => {
		try {
			const folders = await getFolders(signal);
			set({ folders });
		} finally {
			if (get().isFolderFirstLoad) {
				set({ isFolderFirstLoad: false });
			}
		}
	},
	createFolder: async (folderName: string) => {
		await createFolder(folderName);
		await get().getFolders(new AbortController().signal);
	},

	deleteFolder: async (folderId: number) => {
		const documents = get().getDocumentsInFolder(folderId);

		let hasDocumentDeleteError = false;

		// Delete each document in the folder
		if (documents.length > 0) {
			for (const document of documents) {
				const error = await useDocumentStore
					.getState()
					.deleteDocument(document.id);
				if (error) {
					hasDocumentDeleteError = true;
				}
			}
		}

		if (hasDocumentDeleteError) {
			return;
		}

		await deleteFolder(folderId);

		const { folders, selectedChatFolders, selectedFoldersForAction } = get();

		const updatedFolders = folders.filter(({ id }) => id !== folderId);
		const updatedSelectedChatFolders = selectedChatFolders.filter(
			({ id }) => id !== folderId,
		);
		const updatedSelectedFoldersForAction = selectedFoldersForAction.filter(
			({ id }) => id !== folderId,
		);

		set(() => ({
			folders: updatedFolders,
			selectedChatFolders: updatedSelectedChatFolders,
			selectedFoldersForAction: updatedSelectedFoldersForAction,
		}));
	},

	currentFolder: null,
	setCurrentFolder: (folder: DocumentFolder | null) => {
		set({ currentFolder: folder });

		/**
		 * Reset selected folders and documents for action when changing the folder
		 */
		const { selectedFoldersForAction, unselectFolderForAction } = get();
		selectedFoldersForAction.forEach(({ id }) => unselectFolderForAction(id));

		const { selectedDocumentsForAction, unselectDocumentForAction } =
			useDocumentStore.getState();
		selectedDocumentsForAction.forEach(({ id }) =>
			unselectDocumentForAction(id),
		);
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
				useDocumentStore.getState().selectDocumentForAction(item);
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
				useDocumentStore.getState().unselectDocumentForAction(item.id);
			} else {
				unselectFolderForAction(item.id);
			}
		}
	},

	getDocumentsInFolder: (folderId: number) => {
		const { documents } = useDocumentStore.getState();
		return documents.filter((doc) => doc.folder_id === folderId);
	},

	getItemsInCurrentFolder: () => {
		const { folders, currentFolder } = get();
		const { documents, deletedDefaultDocumentIds } =
			useDocumentStore.getState();
		const isNotDeletedDefault = (doc: Document) =>
			!deletedDefaultDocumentIds.includes(doc.id);

		if (!currentFolder) {
			const documentsInCurrentFolder = documents
				.filter(({ folder_id }) => folder_id === null)
				.filter(isNotDeletedDefault);
			return [...folders, ...documentsInCurrentFolder];
		}

		return documents
			.filter(({ folder_id }) => folder_id === currentFolder.id)
			.filter(isNotDeletedDefault);
	},
}));
