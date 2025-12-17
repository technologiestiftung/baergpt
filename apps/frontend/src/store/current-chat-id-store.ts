import { create } from "zustand";
import { useDocumentStore } from "./document-store.ts";
import { useFolderStore } from "./folder-store.ts";
import { useCitationsStore } from "./use-citations-store.ts";
import { useChatsStore } from "./use-chats-store.ts";
import { useInferenceLoadingStatusStore } from "./use-inference-loading-status-store.ts";
import { useChatStreamingStore } from "./use-chat-streaming-store.ts";

interface CurrentChatIdStore {
	currentChatId: number | null;
	setCurrentChatId: (chatId: number | null) => void;
}

const resetPreviousChatState = () => {
	const { selectedChatDocuments, unselectChatDocument } =
		useDocumentStore.getState();
	const { selectedChatFolders, unselectChatFolder } = useFolderStore.getState();
	selectedChatDocuments.forEach((doc) => unselectChatDocument(doc.id));
	selectedChatFolders.forEach((folder) => unselectChatFolder(folder.id));
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

const clearPreviewDocument = () => {
	const { unselectPreviewDocument } = useDocumentStore.getState();
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
				resetPreviousChatState();
			}
			if (chatId !== null) {
				loadChatCitations(chatId);
			}
			clearPreviewDocument();
			hideCompletionLoadingIndicator();

			set({ currentChatId: chatId });
		},
	}),
);
