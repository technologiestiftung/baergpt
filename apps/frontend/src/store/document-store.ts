import { create } from "zustand";
import type { Document } from "../common";
import { getDocuments } from "../api/documents/get-documents";
import { deleteDocument } from "../api/documents/delete-document";
import { updateDocumentFolder } from "../api/documents/update-document-folder";
import { getDocumentObjectUrl } from "../api/documents/get-document-object-url.ts";
import { downloadDocument } from "../api/documents/download-document.ts";

interface DocumentStore {
	documents: Document[];
	isDocumentFirstLoad: boolean;
	getDocuments: (signal: AbortSignal) => Promise<void>;
	deleteDocument: (
		documentId: number,
		filePath: string,
		owned_by_user_id: string | null,
	) => Promise<void>;
	removeItemFromFolder: (documentId: number) => Promise<void>;
	moveItemToFolder: (documentId: number, folderId: number) => Promise<void>;

	selectedPreviewDocument: Document | null;
	selectedPreviewDocumentPreviewUrl: string | null;
	selectedPreviewDocumentDownloadUrl: string | null;
	selectPreviewDocument: (document: Document | null) => void;
	unselectPreviewDocument: () => void;

	selectedChatDocuments: Document[];
	selectChatDocument: (document: Document) => void;
	unselectChatDocument: (documentId: number) => void;
	getSelectedChatDocumentIds: () => number[];

	selectedDocumentsForAction: Document[];
	selectDocumentForAction: (document: Document) => void;
	unselectDocumentForAction: (documentId: number) => void;
}

export const useDocumentStore = create<DocumentStore>((set, get) => ({
	documents: [],
	isDocumentFirstLoad: true,
	getDocuments: async (signal: AbortSignal) => {
		try {
			const documents = await getDocuments(signal);
			set({ documents });
		} finally {
			if (get().isDocumentFirstLoad) {
				set({ isDocumentFirstLoad: false });
			}
		}
	},
	deleteDocument: async (documentId: number) => {
		await deleteDocument(documentId);

		const { documents, selectedChatDocuments, selectedDocumentsForAction } =
			get();

		const updatedDocuments = documents.filter(({ id }) => id !== documentId);
		const updatedSelectedChatDocuments = selectedChatDocuments.filter(
			({ id }) => id !== documentId,
		);
		const updatedSelectedDocumentsForAction = selectedDocumentsForAction.filter(
			({ id }) => id !== documentId,
		);

		set(() => ({
			documents: updatedDocuments,
			selectedChatDocuments: updatedSelectedChatDocuments,
			selectedDocumentsForAction: updatedSelectedDocumentsForAction,
		}));
	},
	removeItemFromFolder: async (documentId: number) => {
		await updateDocumentFolder(documentId, null);
		set((state) => ({
			documents: state.documents.map((doc) =>
				doc.id === documentId ? { ...doc, folder_id: null } : doc,
			),
		}));
	},
	moveItemToFolder: async (documentId: number, folderId: number) => {
		await updateDocumentFolder(documentId, folderId);

		set((state) => ({
			documents: state.documents.map((doc) =>
				doc.id === documentId ? { ...doc, folder_id: folderId } : doc,
			),
		}));
	},

	selectedPreviewDocument: null,
	selectedPreviewDocumentPreviewUrl: null,
	selectedPreviewDocumentDownloadUrl: null,
	selectPreviewDocument: async (document: Document | null) => {
		set({ selectedPreviewDocument: document });

		if (!document) {
			return;
		}

		const previewUrl = await getDocumentObjectUrl({
			sourceUrl: document.source_url,
			sourceType: document.source_type,
		});

		set({ selectedPreviewDocumentPreviewUrl: previewUrl });

		const blob = await downloadDocument({
			sourceUrl: document.source_url,
			sourceType: document.source_type,
		});

		if (!blob) {
			return;
		}

		const downloadUrl = URL.createObjectURL(blob);

		set({ selectedPreviewDocumentDownloadUrl: downloadUrl });
	},
	unselectPreviewDocument: () => {
		set({
			selectedPreviewDocument: null,
			selectedPreviewDocumentPreviewUrl: null,
			selectedPreviewDocumentDownloadUrl: null,
		});
	},

	selectedChatDocuments: [],
	selectChatDocument: (document) => {
		const { selectedChatDocuments } = get();

		/**
		 * Documents can be selected by two ways:
		 * - by clicking on the item checkbox
		 * - by clicking on the select all checkbox
		 * Therefore we need to prevent multi selections
		 */
		const isDocumentAlreadySelected = selectedChatDocuments.some(
			({ id }) => id === document.id,
		);

		if (isDocumentAlreadySelected) {
			return;
		}

		const updatedSelectedChatDocuments = [...selectedChatDocuments, document];

		set(() => ({
			selectedChatDocuments: updatedSelectedChatDocuments,
		}));
	},
	unselectChatDocument: (documentId) => {
		set((state) => ({
			selectedChatDocuments: state.selectedChatDocuments.filter(
				(doc) => doc.id !== documentId,
			),
		}));
	},
	getSelectedChatDocumentIds: () => {
		const { selectedChatDocuments } = get();
		return selectedChatDocuments.map(({ id }) => id);
	},

	selectedDocumentsForAction: [],
	selectDocumentForAction: (document) => {
		const { selectedDocumentsForAction } = get();

		const isDocumentAlreadySelected = selectedDocumentsForAction.some(
			({ id }) => id === document.id,
		);

		if (isDocumentAlreadySelected) {
			return;
		}

		const updatedSelectedDocumentsForAction = [
			...selectedDocumentsForAction,
			document,
		];

		set(() => ({
			selectedDocumentsForAction: updatedSelectedDocumentsForAction,
		}));
	},
	unselectDocumentForAction: (documentId) => {
		set((state) => ({
			selectedDocumentsForAction: state.selectedDocumentsForAction.filter(
				(doc) => doc.id !== documentId,
			),
		}));
	},
}));
