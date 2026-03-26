import { create } from "zustand";
import type { Document, DocumentWithUrl } from "../common";
import { getDocuments } from "../api/documents/get-documents";
import { getPublicDocuments } from "../api/documents/get-public-documents";
import { deleteDocument } from "../api/documents/delete-document";
import { updateDocumentFolder } from "../api/documents/update-document-folder";
import { getDocumentObjectUrl } from "../api/documents/get-document-object-url.ts";
import { downloadDocument } from "../api/documents/download-document.ts";
import { useErrorStore } from "./error-store";
import { hideDefaultDocument } from "../api/documents/hide-default-document";
import { getHiddenDefaultDocumentIds } from "../api/documents/get-hidden-default-document-ids";
import { useChatsStore } from "./use-chats-store.ts";

interface DocumentStore {
	documents: Document[];
	publicDocuments: DocumentWithUrl[];
	isDocumentFirstLoad: boolean;
	isPublicDocumentFirstLoad: boolean;
	isLoading: boolean;
	isPublicDocumentsLoading: boolean;
	deletedDefaultDocumentIds: number[];
	getDocuments: (signal: AbortSignal) => Promise<void>;
	getPublicDocuments: (signal: AbortSignal) => Promise<void>;
	deleteDocument: (documentId: number) => Promise<Error | null>;
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
	toggleChatDocument: (document: Document) => void;
	getSelectedChatDocumentIds: () => number[];

	selectedDocumentsForAction: Document[];
	selectDocumentForAction: (document: Document) => void;
	unselectDocumentForAction: (documentId: number) => void;
}

export const useDocumentStore = create<DocumentStore>((set, get) => ({
	documents: [],
	publicDocuments: [],
	isDocumentFirstLoad: true,
	isPublicDocumentFirstLoad: true,
	isLoading: false,
	isPublicDocumentsLoading: false,
	deletedDefaultDocumentIds: [],
	getDocuments: async (signal: AbortSignal) => {
		set({ isLoading: true });
		try {
			const [documents, deletedDefaultDocumentIds] = await Promise.all([
				getDocuments(signal),
				getHiddenDefaultDocumentIds(),
			]);
			set({ documents, deletedDefaultDocumentIds });
		} finally {
			set({ isLoading: false });
			if (get().isDocumentFirstLoad) {
				set({ isDocumentFirstLoad: false });
			}
		}
	},
	getPublicDocuments: async (signal: AbortSignal) => {
		set({ isPublicDocumentsLoading: true });
		try {
			const documents = await getPublicDocuments(signal);

			// Fetch preview URLs for all public documents
			const documentsWithUrls = await Promise.all(
				documents.map(async (doc): Promise<DocumentWithUrl> => {
					const previewUrl = await getDocumentObjectUrl({
						sourceUrl: doc.source_url,
						sourceType: doc.source_type,
					});
					return { ...doc, previewUrl };
				}),
			);

			set({ publicDocuments: documentsWithUrls });
		} finally {
			set({ isPublicDocumentsLoading: false });
			if (get().isPublicDocumentFirstLoad) {
				set({ isPublicDocumentFirstLoad: false });
			}
		}
	},
	deleteDocument: async (documentId: number) => {
		const { documents, deletedDefaultDocumentIds } = get();
		const documentToDelete = documents.find((doc) => doc.id === documentId);

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

			const { selectedChatDocuments, selectedDocumentsForAction } = get();

			set({
				deletedDefaultDocumentIds: updatedIds,
				selectedChatDocuments: selectedChatDocuments.filter(
					({ id }) => id !== documentId,
				),
				selectedDocumentsForAction: selectedDocumentsForAction.filter(
					({ id }) => id !== documentId,
				),
			});
			return null;
		}

		const error = await deleteDocument(documentId);
		if (error) {
			return error;
		}
		const { selectedChatDocuments, selectedDocumentsForAction } = get();

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

		return null;
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
		useErrorStore.getState().clearUIError("document-download");
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

		const { selectedChatOptions } = useChatsStore.getState();
		if (selectedChatOptions.includes("webSearch")) {
			useChatsStore.getState().toggleChatOption("webSearch");
		}

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
	toggleChatDocument: (document) => {
		const { selectedChatDocuments, selectChatDocument, unselectChatDocument } =
			get();
		const isSelected = selectedChatDocuments.some(
			(doc) => doc.id === document.id,
		);

		if (isSelected) {
			unselectChatDocument(document.id);
			return;
		}

		selectChatDocument(document);
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
