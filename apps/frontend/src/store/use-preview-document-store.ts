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

let latestSelectionRequestId = 0;

export const usePreviewDocumentStore = create<PreviewDocumentStore>((set) => ({
	selectedPreviewDocument: null,
	selectedPreviewDocumentPreviewUrl: null,
	selectedPreviewDocumentDownloadUrl: null,
	isLoadingPreviewDocument: false,

	selectPreviewDocument: async (document: Document | null) => {
		const requestId = ++latestSelectionRequestId;
		const isStale = () => requestId !== latestSelectionRequestId;

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
		useErrorStore.getState().clearUIError("document-download");

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

		if (isStale()) {
			if (previewUrl) {
				URL.revokeObjectURL(previewUrl);
			}
			return;
		}

		set({
			selectedPreviewDocumentPreviewUrl: previewUrl,
			isLoadingPreviewDocument: false,
		});

		const blob = await downloadDocument({
			sourceUrl: document.source_url,
			sourceType: document.source_type,
		});

		if (isStale()) {
			return;
		}

		if (!blob) {
			useErrorStore
				.getState()
				.setUIError("document-download", "document_download_failed");
			return;
		}

		const downloadUrl = URL.createObjectURL(blob);

		set({ selectedPreviewDocumentDownloadUrl: downloadUrl });
	},
	unselectPreviewDocument: () => {
		latestSelectionRequestId++;
		useErrorStore.getState().clearUIError("document-download");
		set({
			selectedPreviewDocument: null,
			selectedPreviewDocumentPreviewUrl: null,
			selectedPreviewDocumentDownloadUrl: null,
			isLoadingPreviewDocument: false,
		});
	},
}));
