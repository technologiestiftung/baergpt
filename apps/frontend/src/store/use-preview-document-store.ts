import { create } from "zustand";
import { getDocumentObjectUrl } from "../api/documents/get-document-object-url.ts";
import { downloadDocument } from "../api/documents/download-document.ts";
import { useErrorStore } from "./error-store.ts";
import { type Document } from "../common.ts";

interface PreviewDocumentStore {
	selectedPreviewDocument: Document | null;
	selectedPreviewDocumentPreviewUrl: string | null;
	selectedPreviewDocumentDownloadUrl: string | null;
	selectPreviewDocument: (document: Document | null) => void;
	unselectPreviewDocument: () => void;
}

export const usePreviewDocumentStore = create<PreviewDocumentStore>((set) => ({
	selectedPreviewDocument: null,
	selectedPreviewDocumentPreviewUrl: null,
	selectedPreviewDocumentDownloadUrl: null,

	selectPreviewDocument: async (document: Document | null) => {
		const {
			selectedPreviewDocumentDownloadUrl,
			selectedPreviewDocumentPreviewUrl,
		} = usePreviewDocumentStore.getState();
		if (selectedPreviewDocumentDownloadUrl) {
			URL.revokeObjectURL(selectedPreviewDocumentDownloadUrl);
		}
		if (selectedPreviewDocumentPreviewUrl) {
			URL.revokeObjectURL(selectedPreviewDocumentPreviewUrl);
		}

		set({
			selectedPreviewDocument: document,
			selectedPreviewDocumentPreviewUrl: null,
			selectedPreviewDocumentDownloadUrl: null,
		});

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
}));
