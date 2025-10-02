import { create } from "zustand";
import type { Document } from "../common";
import { getDocuments } from "../api/documents/get-documents";
import { deleteDocument } from "../api/documents/delete-document.ts";

interface DocumentStore {
	documents: Document[];
	isDocumentFirstLoad: boolean;
	isDeleteDocumentDialogOpen: boolean;
	selectedDocument: Document | null;
	getDocuments: (signal: AbortSignal) => Promise<void>;
	deleteDocument: (
		documentId: number,
		filePath: string,
		owned_by_user_id?: string,
	) => Promise<void>;
	setSelectedDocument: (document: Document | null) => void;
	setDeleteDocumentDialogOpen: (isOpen: boolean) => void;
}

export const useDocumentStore = create<DocumentStore>((set, get) => ({
	documents: [],
	isDocumentFirstLoad: true,
	isDeleteDocumentDialogOpen: false,
	selectedDocument: null,

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

		const { documents } = get();

		set(() => ({
			documents: documents.filter(({ id }) => id !== documentId),
		}));
	},
	setSelectedDocument: (document: Document | null) =>
		set({ selectedDocument: document }),
	setDeleteDocumentDialogOpen: (isOpen: boolean) =>
		set({ isDeleteDocumentDialogOpen: isOpen }),
}));
