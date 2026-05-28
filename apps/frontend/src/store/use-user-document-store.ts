import { create } from "zustand";
import type { UserDocument } from "../common";
import { getDocuments } from "../api/documents/get-documents";
import { deleteDocument } from "../api/documents/delete-document";
import { updateDocumentFolder } from "../api/documents/update-document-folder";
import { hideDefaultDocument } from "../api/documents/hide-default-document";
import { getHiddenDefaultDocumentIds } from "../api/documents/get-hidden-default-document-ids";
import { useChatsStore } from "./use-chats-store.ts";
import { EXTERNAL_TOOL_PRIVACY_CONFIG } from "../common.ts";

interface UserDocumentStore {
	userDocuments: UserDocument[];
	isDocumentFirstLoad: boolean;
	isLoading: boolean;
	deletedDefaultDocumentIds: number[];
	getUserDocuments: (signal: AbortSignal) => Promise<void>;

	deleteUserDocument: (documentId: number) => Promise<Error | null>;
	removeItemFromFolder: (documentId: number) => Promise<void>;
	moveItemToFolder: (documentId: number, folderId: number) => Promise<void>;

	selectedUserChatDocuments: UserDocument[];
	selectUserChatDocument: (document: UserDocument) => void;
	unselectUserChatDocument: (documentId: number) => void;
	toggleUserChatDocument: (document: UserDocument) => void;
	getSelectedUserChatDocumentIds: () => number[];

	selectedUserDocumentsForAction: UserDocument[];
	selectUserDocumentForAction: (document: UserDocument) => void;
	unselectUserDocumentForAction: (documentId: number) => void;
}

export const useUserDocumentStore = create<UserDocumentStore>((set, get) => ({
	userDocuments: [],
	isDocumentFirstLoad: true,
	isLoading: false,
	deletedDefaultDocumentIds: [],
	getUserDocuments: async (signal: AbortSignal) => {
		set({ isLoading: true });
		try {
			const [documents, deletedDefaultDocumentIds] = await Promise.all([
				getDocuments(signal),
				getHiddenDefaultDocumentIds(signal),
			]);
			set({ userDocuments: documents, deletedDefaultDocumentIds });
		} finally {
			set({ isLoading: false });
			if (get().isDocumentFirstLoad) {
				set({ isDocumentFirstLoad: false });
			}
		}
	},

	deleteUserDocument: async (documentId: number) => {
		const { userDocuments, deletedDefaultDocumentIds } = get();
		const documentToDelete = userDocuments.find((doc) => doc.id === documentId);

		// Prevent deletion of default documents
		if (documentToDelete?.source_type === "default_document") {
			const updatedIds = [...deletedDefaultDocumentIds];
			if (!updatedIds.includes(documentId)) {
				updatedIds.push(documentId);
				const error = await hideDefaultDocument(documentId);
				if (error) {
					return error;
				}
			}

			const { selectedUserChatDocuments, selectedUserDocumentsForAction } =
				get();

			set({
				deletedDefaultDocumentIds: updatedIds,
				selectedUserChatDocuments: selectedUserChatDocuments.filter(
					({ id }) => id !== documentId,
				),
				selectedUserDocumentsForAction: selectedUserDocumentsForAction.filter(
					({ id }) => id !== documentId,
				),
			});
			return null;
		}

		const error = await deleteDocument(documentId);
		if (error) {
			return error;
		}
		const { selectedUserChatDocuments, selectedUserDocumentsForAction } = get();

		const updatedDocuments = userDocuments.filter(
			({ id }) => id !== documentId,
		);
		const updatedSelectedChatDocuments = selectedUserChatDocuments.filter(
			({ id }) => id !== documentId,
		);
		const updatedSelectedDocumentsForAction =
			selectedUserDocumentsForAction.filter(({ id }) => id !== documentId);

		set(() => ({
			userDocuments: updatedDocuments,
			selectedUserChatDocuments: updatedSelectedChatDocuments,
			selectedUserDocumentsForAction: updatedSelectedDocumentsForAction,
		}));

		return null;
	},
	removeItemFromFolder: async (documentId: number) => {
		await updateDocumentFolder(documentId, null);
		set((state) => ({
			userDocuments: state.userDocuments.map((doc) =>
				doc.id === documentId ? { ...doc, folder_id: null } : doc,
			),
		}));
	},
	moveItemToFolder: async (documentId: number, folderId: number) => {
		await updateDocumentFolder(documentId, folderId);

		set((state) => ({
			userDocuments: state.userDocuments.map((doc) =>
				doc.id === documentId ? { ...doc, folder_id: folderId } : doc,
			),
		}));
	},

	selectedUserChatDocuments: [],
	selectUserChatDocument: (document) => {
		const { selectedUserChatDocuments } = get();

		/**
		 * Documents can be selected by two ways:
		 * - by clicking on the item checkbox
		 * - by clicking on the select all checkbox
		 * Therefore we need to prevent multi selections
		 */
		const isDocumentAlreadySelected = selectedUserChatDocuments.some(
			({ id }) => id === document.id,
		);

		if (isDocumentAlreadySelected) {
			return;
		}

		const updatedSelectedChatDocuments = [
			...selectedUserChatDocuments,
			document,
		];

		const { selectedChatOptions } = useChatsStore.getState();
		const activeExternalTool = selectedChatOptions.find(
			(option) => EXTERNAL_TOOL_PRIVACY_CONFIG[option],
		);
		if (activeExternalTool) {
			useChatsStore.getState().toggleChatOption(activeExternalTool);
			useChatsStore.getState().setExternalToolInfoMessage(activeExternalTool);
		}

		set(() => ({
			selectedUserChatDocuments: updatedSelectedChatDocuments,
		}));
	},
	unselectUserChatDocument: (documentId) => {
		set((state) => ({
			selectedUserChatDocuments: state.selectedUserChatDocuments.filter(
				(doc) => doc.id !== documentId,
			),
		}));
	},
	toggleUserChatDocument: (document) => {
		const {
			selectedUserChatDocuments,
			selectUserChatDocument,
			unselectUserChatDocument,
		} = get();
		const isSelected = selectedUserChatDocuments.some(
			(doc) => doc.id === document.id,
		);

		if (isSelected) {
			unselectUserChatDocument(document.id);
			return;
		}

		selectUserChatDocument(document);
	},
	getSelectedUserChatDocumentIds: () => {
		const { selectedUserChatDocuments } = get();
		return selectedUserChatDocuments.map(({ id }) => id);
	},

	selectedUserDocumentsForAction: [],
	selectUserDocumentForAction: (document) => {
		const { selectedUserDocumentsForAction } = get();

		const isDocumentAlreadySelected = selectedUserDocumentsForAction.some(
			({ id }) => id === document.id,
		);

		if (isDocumentAlreadySelected) {
			return;
		}

		const updatedSelectedDocumentsForAction = [
			...selectedUserDocumentsForAction,
			document,
		];

		set(() => ({
			selectedUserDocumentsForAction: updatedSelectedDocumentsForAction,
		}));
	},
	unselectUserDocumentForAction: (documentId) => {
		set((state) => ({
			selectedUserDocumentsForAction:
				state.selectedUserDocumentsForAction.filter(
					(doc) => doc.id !== documentId,
				),
		}));
	},
}));
