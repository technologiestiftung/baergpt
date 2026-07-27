import { create } from "zustand";
import type {
	ChatWithMessages,
	NewChatMessage,
	ChatTool,
	LlmModel,
} from "../common";
import { useCurrentChatIdStore } from "./current-chat-id-store.ts";
import { getChats as getChatsFromDb } from "../api/chat/get-chats.ts";
import { insertChat as insertChatIntoDb } from "../api/chat/insert-chat.ts";
import { deleteChat as deleteChatFromDb } from "../api/chat/delete-chat.ts";
import { getMessages as getMessagesFromDb } from "../api/message/get-messages.ts";
import { insertMessage as insertMessageIntoDb } from "../api/message/insert-message.ts";
import { updateMessage as updateMessageInDb } from "../api/message/update-message.ts";
import { getTotalChatCount as getTotalChatCountFromDb } from "../api/chat/get-total-chat-count.ts";
import { useErrorStore } from "./error-store.ts";
import type {
	WebCitationSource,
	ParlaCitationSource,
	OpenDataCitationSource,
} from "../api/chat/get-completion.ts";
import { useUserDocumentStore } from "./use-user-document-store.ts";
import { useUserFolderStore } from "./use-user-folder-store.ts";
import { usePublicDocumentsStore } from "./use-public-documents-store.ts";

let updateMessageDebounceTimeout: ReturnType<typeof setTimeout>;
let getChatsDebounceTimeout: ReturnType<typeof setTimeout>;
let autoDeactivateExternalToolTimeout: ReturnType<typeof setTimeout>;

interface ChatStore {
	isFirstLoad: boolean;
	isLoading: boolean;
	chats: ChatWithMessages[];
	totalChatCount: number | null;
	selectedChatTools: ChatTool[];
	selectedLlmModel: LlmModel;
	resetToDefaultChatTools(): void;
	toggleChatTool(tool: ChatTool): void;
	setSelectedLlmModel(model: LlmModel): void;
	updateChats(givenChat: ChatWithMessages): void;
	getChatsFromDb(signal: AbortSignal): Promise<void>;
	getNextChatsPage(): Promise<void>;
	syncChats(newChats: ChatWithMessages[]): void;
	getCurrentChat(): ChatWithMessages | undefined;
	getCurrentOrCreateChat(
		chatMessage: NewChatMessage,
	): Promise<ChatWithMessages>;
	createChat(firstMessage: NewChatMessage): Promise<ChatWithMessages>;
	deleteChat(chatId: number): Promise<void>;
	addMessageToChat(
		chat: ChatWithMessages,
		chatMessage: NewChatMessage,
	): Promise<number>;
	updateMessage(args: {
		chat: ChatWithMessages;
		messageId: number;
		content: string;
		citations: number[] | null;
		web_citations: WebCitationSource[] | null;
		parla_citations: ParlaCitationSource[] | null;
		open_data_citations: OpenDataCitationSource[] | null;
	}): void;
	autoDeactivatedExternalTools: ChatTool[];
	setAutoDeactivatedExternalTools(tools: ChatTool[]): void;
	deactivateExternalTools(): void;
}

const externalChatTools: ChatTool[] = [
	"webSearch",
	"parla",
	"openData",
	"datawrapper",
];

export const useChatsStore = create<ChatStore>()((set, get) => ({
	isFirstLoad: true,
	isLoading: false,
	chats: [],
	totalChatCount: null,
	selectedChatTools: [],
	selectedLlmModel: "mistral-small",
	autoDeactivatedExternalTools: [],

	setSelectedLlmModel(model: LlmModel) {
		set({ selectedLlmModel: model });
	},

	resetToDefaultChatTools() {
		set({ selectedChatTools: [], autoDeactivatedExternalTools: [] });
	},

	toggleChatTool(tool: ChatTool) {
		const { selectedChatTools } = get();

		if (selectedChatTools.includes(tool)) {
			set({
				selectedChatTools: selectedChatTools.filter(
					(active) => active !== tool,
				),
			});
			return;
		}

		// Activating any external tool clears selected documents/folders, because
		// document/folder RAG is mutually exclusive with external tools.
		if (externalChatTools.includes(tool)) {
			const { selectedUserChatDocuments, unselectUserChatDocument } =
				useUserDocumentStore.getState();
			selectedUserChatDocuments.forEach((document) =>
				unselectUserChatDocument(document.id),
			);

			const { selectedUserChatFolders, unselectUserChatFolder } =
				useUserFolderStore.getState();
			selectedUserChatFolders.forEach((folder) =>
				unselectUserChatFolder(folder.id),
			);

			const {
				selectedPublicChatDocuments,
				selectedPublicChatFolders,
				unselectPublicChatDocument,
				unselectPublicChatFolder,
			} = usePublicDocumentsStore.getState();
			selectedPublicChatDocuments.forEach((document) =>
				unselectPublicChatDocument(document.id),
			);
			selectedPublicChatFolders.forEach((folder) =>
				unselectPublicChatFolder(folder.id),
			);
		}

		set({ selectedChatTools: [...selectedChatTools, tool] });
	},

	/**
	 * Fetches the user's chats from the database
	 * and their messages and sets them in the store
	 */
	async getChatsFromDb(signal) {
		set({ isLoading: true });

		const offset = get().chats.length;

		// Clear any existing fetch error when starting a new fetch attempt
		useErrorStore.getState().clearUIError("chats-fetch");

		const totalChatCount = await getTotalChatCountFromDb(signal);

		set({ totalChatCount });

		const chatsFromDb = await getChatsFromDb(offset, signal);

		const promises = chatsFromDb.map(async (chat) => {
			const messages = await getMessagesFromDb(chat.id, signal);
			return { ...chat, messages };
		});

		const chatsWithMessages = await Promise.all(promises);

		get().syncChats(chatsWithMessages);

		if (get().isFirstLoad) {
			set({ isFirstLoad: false });
		}

		set({ isLoading: false });
	},

	syncChats(newChats: ChatWithMessages[]) {
		const existingChats = get().chats;

		const synchronizedChats: ChatWithMessages[] = [...existingChats];

		newChats.forEach((newChat) => {
			const isDuplicate = existingChats.some((chat) => chat.id === newChat.id);
			if (isDuplicate) {
				return;
			}
			synchronizedChats.push(newChat);
		});

		set({ chats: synchronizedChats });
	},

	async getNextChatsPage() {
		clearTimeout(getChatsDebounceTimeout);

		const { totalChatCount, chats } = get();
		if (totalChatCount === null) {
			return;
		}

		const hasLoadedAllChats = chats.length === totalChatCount;
		if (hasLoadedAllChats) {
			return;
		}

		getChatsDebounceTimeout = setTimeout(async () => {
			await get().getChatsFromDb(new AbortController().signal);
		}, 200);
	},

	getCurrentChat: () => {
		const currentChatId = useCurrentChatIdStore.getState().currentChatId;
		const { chats } = get();

		return chats.find((chat) => chat.id === currentChatId);
	},

	/**
	 * Gets the current chat or creates a new one
	 * if the current chat does not exist
	 * and adds the given message to the chat
	 */
	async getCurrentOrCreateChat(chatMessage) {
		const currentChat = get().getCurrentChat();

		if (!currentChat) {
			return get().createChat(chatMessage);
		}

		await get().addMessageToChat(currentChat, chatMessage);

		return currentChat;
	},

	/**
	 * Updates the chats in the store with the given chat
	 */
	updateChats(givenChat: ChatWithMessages) {
		const updatedChats = get().chats.map((chat) => {
			if (givenChat.id === chat.id) {
				return givenChat;
			}

			return chat;
		});

		set({ chats: updatedChats });
	},

	/**
	 * Creates a new chat with the given message
	 * and sets it as the current chat
	 * and adds the first message to the chat
	 */
	async createChat(firstMessage) {
		const chat = await insertChatIntoDb(firstMessage.content);
		const chatWithMessages = { ...chat, messages: [] };

		set({ chats: [chatWithMessages, ...get().chats] });

		useCurrentChatIdStore.getState().setCurrentChatId(chatWithMessages.id);

		await get().addMessageToChat(chatWithMessages, firstMessage);

		return chatWithMessages;
	},

	/**
	 * Deletes the chat with the given id
	 */
	async deleteChat(chatId) {
		const updatedChats = get().chats.filter((chat) => chat.id !== chatId);

		set({ chats: updatedChats });

		await deleteChatFromDb(chatId);
	},

	/**
	 * Adds the given message to the given chat
	 */
	async addMessageToChat(givenChat, givenMessage) {
		const message = await insertMessageIntoDb(givenChat.id, givenMessage);

		givenChat.messages.push(message);

		get().updateChats(givenChat);

		return message.id;
	},

	/**
	 * Updates the content of a message
	 * and debounces updating the message in the database
	 */
	updateMessage: ({
		chat,
		messageId,
		content,
		citations,
		web_citations,
		parla_citations,
		open_data_citations,
	}) => {
		clearTimeout(updateMessageDebounceTimeout);

		const foundMessage = chat.messages.find(
			(message) => message.id === messageId,
		);
		if (!foundMessage) {
			return;
		}

		foundMessage.content = content;
		foundMessage.citations = citations;
		foundMessage.web_citations = web_citations;
		foundMessage.parla_citations = parla_citations;
		foundMessage.open_data_citations = open_data_citations;
		get().updateChats(chat);

		updateMessageDebounceTimeout = setTimeout(async () => {
			await updateMessageInDb(messageId, {
				content,
				citations,
				web_citations,
				parla_citations,
				open_data_citations,
			});
		}, 300);
	},

	setAutoDeactivatedExternalTools(tools: ChatTool[]) {
		if (autoDeactivateExternalToolTimeout) {
			clearTimeout(autoDeactivateExternalToolTimeout);
		}
		set({ autoDeactivatedExternalTools: tools });
		autoDeactivateExternalToolTimeout = setTimeout(() => {
			set({ autoDeactivatedExternalTools: [] });
		}, 20_000);
	},

	deactivateExternalTools() {
		const { selectedChatTools } = get();
		const activeExternalTools = selectedChatTools.filter((tool) =>
			externalChatTools.includes(tool),
		);
		if (activeExternalTools.length === 0) {
			return;
		}
		set({
			selectedChatTools: selectedChatTools.filter(
				(tool) => !externalChatTools.includes(tool),
			),
		});
		get().setAutoDeactivatedExternalTools(activeExternalTools);
	},
}));
