import { create } from "zustand";
import { downloadDocument } from "../api/documents/download-document.ts";
import { downloadBlob, downloadUrl } from "../lib/download-blob.ts";
import { usePreviewDocumentStore } from "./use-preview-document-store.ts";
import { useToastStore } from "./use-toast-store.ts";
import { type Document } from "../common.ts";
import Content from "../content.ts";

interface DocumentDownloadStore {
	/** Keyed by source_url, because user and public document ids can collide. */
	downloadingSourceUrls: string[];
	downloadDocumentFile: (document: Document) => Promise<void>;
}

export const useDocumentDownloadStore = create<DocumentDownloadStore>(
	(set, get) => ({
		downloadingSourceUrls: [],

		downloadDocumentFile: async (document: Document) => {
			const { source_url: sourceUrl, source_type: sourceType } = document;
			const fileName =
				document.file_name ?? sourceUrl.slice(sourceUrl.lastIndexOf("/") + 1);

			const { selectedPreviewDocument, selectedPreviewDocumentDownloadUrl } =
				usePreviewDocumentStore.getState();
			if (
				selectedPreviewDocument?.source_url === sourceUrl &&
				selectedPreviewDocumentDownloadUrl
			) {
				downloadUrl(selectedPreviewDocumentDownloadUrl, fileName);
				return;
			}

			if (get().downloadingSourceUrls.includes(sourceUrl)) {
				return;
			}

			set((state) => ({
				downloadingSourceUrls: [...state.downloadingSourceUrls, sourceUrl],
			}));

			try {
				const blob = await downloadDocument({ sourceUrl, sourceType });

				if (!blob) {
					useToastStore
						.getState()
						.addError(Content["documentsPreviewSection.download.failed.error"]);
					return;
				}

				downloadBlob(blob, fileName);
			} finally {
				set((state) => ({
					downloadingSourceUrls: state.downloadingSourceUrls.filter(
						(url) => url !== sourceUrl,
					),
				}));
			}
		},
	}),
);
