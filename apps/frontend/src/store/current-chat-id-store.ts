import { create } from "zustand";
import { useDocumentStore } from "./document-store.ts";
import { useFolderStore } from "./folder-store.ts";
import { useCitationsStore } from "./use-citations-store.ts";
import { useChatsStore } from "./use-chats-store.ts";
import { useInferenceLoadingStatusStore } from "./use-inference-loading-status-store.ts";
import { useChatStreamingStore } from "./use-chat-streaming-store.ts";
import { getExternalCitationsForMessages } from "../api/citations/get-external-citations-for-messages.ts";

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

const loadChatCitations = async (chatId: number) => {
	const { ensureCached, storeParlaCitations } = useCitationsStore.getState();
	const chats = useChatsStore.getState().chats;
	const selectedChat = chats.find((chatItem) => chatItem.id === chatId);
	if (!selectedChat) {
		return;
	}

	const allCitationIds = selectedChat.messages.flatMap(
		(message) => message.citations ?? [],
	);

	// Separate numeric chunk IDs from string external citation IDs
	const numericChunkIds = allCitationIds.filter(
		(id): id is number => typeof id === "number",
	);
	const hasExternalCitations = allCitationIds.some(
		(id) => typeof id === "string",
	);

	// Fetch and cache regular citations (from document chunks)
	if (numericChunkIds.length > 0) {
		void ensureCached(numericChunkIds);
	}

	// Fetch and cache external citations
	if (hasExternalCitations) {
		const messageIds = selectedChat.messages
			.filter((message) => message.citations && message.citations.length > 0)
			.map((message) => message.id);

		const externalCitations = await getExternalCitationsForMessages(messageIds);
		if (externalCitations.length > 0) {
			storeParlaCitations(externalCitations);
		}
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
				useChatsStore.getState().resetToDefaultChatOptions();
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
