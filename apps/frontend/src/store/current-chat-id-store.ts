import { create } from "zustand";
import { useUserDocumentStore } from "./use-user-document-store.ts";
import { useUserFolderStore } from "./use-user-folder-store.ts";
import { useCitationsStore } from "./use-citations-store.ts";
import { useFaviconStore } from "./favicon-store.ts";
import { useChatsStore } from "./use-chats-store.ts";
import { useInferenceLoadingStatusStore } from "./use-inference-loading-status-store.ts";
import { useChatStreamingStore } from "./use-chat-streaming-store.ts";
import { usePreviewDocumentStore } from "./use-preview-document-store.ts";
import { usePublicDocumentsStore } from "./use-public-documents-store.ts";

interface CurrentChatIdStore {
	currentChatId: number | null;
	setCurrentChatId: (chatId: number | null) => void;
}

const resetPreviousChatState = () => {
	const { selectedUserChatDocuments, unselectUserChatDocument } =
		useUserDocumentStore.getState();
	const {
		selectedChatFolders: selectedUserChatFolders,
		unselectChatFolder: unselectUserChatFolder,
	} = useUserFolderStore.getState();
	const {
		selectedPublicChatFolders,
		unselectPublicChatFolder,
		selectedPublicChatDocuments,
		unselectPublicChatDocument,
	} = usePublicDocumentsStore.getState();

	selectedUserChatDocuments.forEach((doc) => unselectUserChatDocument(doc.id));
	selectedUserChatFolders.forEach((folder) =>
		unselectUserChatFolder(folder.id),
	);
	selectedPublicChatFolders.forEach((folder) =>
		unselectPublicChatFolder(folder.id),
	);
	selectedPublicChatDocuments.forEach((doc) =>
		unselectPublicChatDocument(doc.id),
	);
};

const loadChatCitations = (chatId: number) => {
	const { ensureCached } = useCitationsStore.getState();
	const chats = useChatsStore.getState().chats;
	const selectedChat = chats.find((chatItem) => chatItem.id === chatId);
	if (!selectedChat) {
		return;
	}
	const allChunkIds = selectedChat.messages.flatMap(
		(message) => message.citations ?? [],
	);

	if (allChunkIds.length > 0) {
		void ensureCached(allChunkIds);
	}
};

const loadChatFavicons = (chatId: number) => {
	const { ensureFaviconsCached } = useFaviconStore.getState();
	const chats = useChatsStore.getState().chats;
	const selectedChat = chats.find((chatItem) => chatItem.id === chatId);
	if (!selectedChat) {
		return;
	}
	const webCitationUrls = selectedChat.messages
		.flatMap((message) => message.web_citations ?? [])
		.map(({ url }) => url);
	if (webCitationUrls.length > 0) {
		void ensureFaviconsCached(webCitationUrls);
	}
};

const clearPreviewDocument = () => {
	const { unselectPreviewDocument } = usePreviewDocumentStore.getState();
	unselectPreviewDocument();
};

const hideCompletionLoadingIndicator = () => {
	const { setStatus } = useInferenceLoadingStatusStore.getState();
	setStatus("idle");
};

export const useCurrentChatIdStore = create<CurrentChatIdStore>()(
	(set, get) => ({
		currentChatId: null,
		setCurrentChatId: (chatId) => {
			const prevChatId = get().currentChatId;
			const isFirstChat = prevChatId === null;

			// Abort any ongoing streaming when switching chats
			const { abortStreaming } = useChatStreamingStore.getState();
			abortStreaming();

			if (!isFirstChat) {
				useChatsStore.getState().resetToDefaultChatOptions();
				resetPreviousChatState();
			}
			if (chatId !== null) {
				loadChatCitations(chatId);
				loadChatFavicons(chatId);
			}
			clearPreviewDocument();
			hideCompletionLoadingIndicator();

			set({ currentChatId: chatId });
		},
	}),
);
