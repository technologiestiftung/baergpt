import { create } from "zustand";
import { getDocumentObjectUrl } from "../api/documents/get-document-object-url.ts";
import { downloadDocument } from "../api/documents/download-document.ts";
import { useErrorStore } from "./error-store.ts";
import { type Document } from "../common.ts";

interface PreviewDocumentStore {
	selectedPreviewDocument: Document | null;
	selectedPreviewDocumentPreviewUrl: string | null;
	selectedPreviewDocumentDownloadUrl: string | null;
	/** True while the preview file is being downloaded (before it can be rendered at all). */
	isLoadingPreviewDocument: boolean;
	selectPreviewDocument: (document: Document | null) => void;
	unselectPreviewDocument: () => void;
}

export const usePreviewDocumentStore = create<PreviewDocumentStore>((set) => ({
	selectedPreviewDocument: null,
	selectedPreviewDocumentPreviewUrl: null,
	selectedPreviewDocumentDownloadUrl: null,
	isLoadingPreviewDocument: false,

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
			isLoadingPreviewDocument: document !== null,
		});

		if (!document) {
			return;
		}

		const previewUrl = await getDocumentObjectUrl({
			sourceUrl: document.source_url,
			sourceType: document.source_type,
		});

		set({
			selectedPreviewDocumentPreviewUrl: previewUrl,
			isLoadingPreviewDocument: false,
		});

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
			isLoadingPreviewDocument: false,
		});
	},
}));
