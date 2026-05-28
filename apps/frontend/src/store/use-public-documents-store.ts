import { create } from "zustand";
import type { PublicDocument, PublicFolder } from "../common";
import { EXTERNAL_TOOL_PRIVACY_CONFIG } from "../common.ts";
import { getPublicDocuments as getPublicDocumentsFromDb } from "../api/documents/get-public-documents";
import Content from "../content.ts";
import { useChatsStore } from "./use-chats-store.ts";

type PublicDocumentsStore = {
	publicDocuments: PublicDocument[];
	getPublicDocuments: (signal: AbortSignal) => Promise<void>;

	selectedPublicChatDocuments: PublicDocument[];
	selectPublicChatDocument: (publicDocument: PublicDocument) => void;
	unselectPublicChatDocument: (publicDocumentId: number) => void;
	togglePublicChatDocument: (publicDocument: PublicDocument) => void;

	publicFolders: PublicFolder[];

	selectedPublicChatFolders: PublicFolder[];
	selectPublicChatFolder: (publicFolder: PublicFolder) => void;
	unselectPublicChatFolder: (publicFolderId: number) => void;
	togglePublicChatFolder: (publicFolder: PublicFolder) => void;

	getSelectedPublicChatDocumentIds: () => number[];
};

const baseKnowledgeFolder = {
	id: -1,
	name: Content["documentSection.publicFolder.baseKnowledge.label"],
};

export const usePublicDocumentsStore = create<PublicDocumentsStore>(
	(set, get) => ({
		publicDocuments: [],

		getPublicDocuments: async (signal: AbortSignal) => {
			const publicDocuments = await getPublicDocumentsFromDb(signal);
			set({ publicDocuments });
		},

		publicFolders: [baseKnowledgeFolder],

		selectedPublicChatDocuments: [],

		selectPublicChatDocument: (publicDocument) => {
			const { selectedChatOptions } = useChatsStore.getState();
			const activeExternalTool = selectedChatOptions.find(
				(option) => EXTERNAL_TOOL_PRIVACY_CONFIG[option],
			);
			if (activeExternalTool) {
				useChatsStore.getState().toggleChatOption(activeExternalTool);
				useChatsStore.getState().setExternalToolInfoMessage(activeExternalTool);
			}

			set(({ selectedPublicChatDocuments }) => ({
				selectedPublicChatDocuments: [
					...selectedPublicChatDocuments,
					publicDocument,
				],
			}));
		},

		unselectPublicChatDocument: (publicDocumentId) => {
			set(({ selectedPublicChatDocuments }) => ({
				selectedPublicChatDocuments: selectedPublicChatDocuments.filter(
					({ id }) => id !== publicDocumentId,
				),
			}));
		},

		togglePublicChatDocument: (publicDocument) => {
			const {
				selectedPublicChatDocuments,
				selectPublicChatDocument,
				unselectPublicChatDocument,
			} = get();
			const isSelected = selectedPublicChatDocuments.some(
				({ id }) => id === publicDocument.id,
			);

			if (isSelected) {
				unselectPublicChatDocument(publicDocument.id);
				return;
			}

			selectPublicChatDocument(publicDocument);
		},

		selectedPublicChatFolders: [],

		selectPublicChatFolder: (publicFolder) => {
			set(({ selectedPublicChatFolders }) => ({
				selectedPublicChatFolders: [...selectedPublicChatFolders, publicFolder],
			}));
		},

		unselectPublicChatFolder: (publicFolderId) => {
			set(({ selectedPublicChatFolders }) => ({
				selectedPublicChatFolders: selectedPublicChatFolders.filter(
					({ id }) => id !== publicFolderId,
				),
			}));
		},

		togglePublicChatFolder: (publicFolder) => {
			const {
				selectedPublicChatFolders,
				selectPublicChatFolder,
				unselectPublicChatFolder,
			} = get();
			const isSelected = selectedPublicChatFolders.some(
				({ id }) => id === publicFolder.id,
			);

			if (isSelected) {
				unselectPublicChatFolder(publicFolder.id);
				return;
			}

			selectPublicChatFolder(publicFolder);
		},

		getSelectedPublicChatDocumentIds: () => {
			const {
				selectedPublicChatFolders,
				publicDocuments,
				selectedPublicChatDocuments,
			} = get();

			/**
			 * Currently we only have one public folder.
			 * If it is selected, return all public document ids.
			 */
			if (selectedPublicChatFolders.length > 0) {
				return publicDocuments.map((document) => document.id);
			}

			return selectedPublicChatDocuments.map((document) => document.id);
		},
	}),
);
