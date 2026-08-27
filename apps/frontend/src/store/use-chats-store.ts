import { create } from "zustand";
import type {
	ChatWithMessages,
	ChatMessage,
	NewChatMessage,
	ChatTool,
	LlmModel,
} from "../common";
import { useCurrentChatIdStore } from "./current-chat-id-store.ts";
import {
	getChats as getChatsFromDb,
	CHATS_PAGE_SIZE,
} from "../api/chat/get-chats.ts";
import { insertChat as insertChatIntoDb } from "../api/chat/insert-chat.ts";
import { deleteChat as deleteChatFromDb } from "../api/chat/delete-chat.ts";
import { renameChat as renameChatInDb } from "../api/chat/rename-chat.ts";
import { getMessages as getMessagesFromDb } from "../api/message/get-messages.ts";
import { insertMessage as insertMessageIntoDb } from "../api/message/insert-message.ts";
import { useErrorStore } from "./error-store.ts";
import type {
	WebCitationSource,
	ParlaCitationSource,
	OpenDataCitationSource,
} from "../api/chat/get-completion.ts";
import { useUserDocumentStore } from "./use-user-document-store.ts";
import { useUserFolderStore } from "./use-user-folder-store.ts";
import { usePublicDocumentsStore } from "./use-public-documents-store.ts";

let getChatsDebounceTimeout: ReturnType<typeof setTimeout>;
let visibleInfoMessageTimeout: ReturnType<typeof setTimeout>;

/**
 * Client-generated ids for not-yet-persisted messages. Always negative so
 * they never collide with real (positive) DB ids.
 */
let nextLocalMessageId = -1;

export type VisibleChatInfoMessage =
	| { type: "toolDeactivated"; tools: ChatTool[] }
	| { type: "historyScoped" }
	| null;

interface ChatStore {
	isFirstLoad: boolean;
	isLoading: boolean;
	chats: ChatWithMessages[];
	hasMoreChats: boolean;
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
	renameChat(chatId: number, newName: string): Promise<void>;
	addMessageToChat(
		chat: ChatWithMessages,
		chatMessage: NewChatMessage,
	): Promise<number>;
	/**
	 * Creates a message in memory only, no DB write. Returns its local id,
	 * used until `persistPendingMessageToDb` or `removePendingMessageFromMemory`.
	 */
	createPendingMessageInMemory(
		chat: ChatWithMessages,
		chatMessage: NewChatMessage,
	): number;
	/**
	 * Persists a local message to the DB and replaces it with the DB-assigned row.
	 */
	persistPendingMessageToDb(
		chat: ChatWithMessages,
		localMessageId: number,
		chatMessage: NewChatMessage,
	): Promise<void>;
	/**
	 * Removes a message from memory only, no DB call — for messages that
	 * never made it to the DB.
	 */
	removePendingMessageFromMemory(
		chat: ChatWithMessages,
		messageId: number,
	): void;
	updateMessage(args: {
		chat: ChatWithMessages;
		messageId: number;
		content: string;
		citations: number[] | null;
		web_citations: WebCitationSource[] | null;
		parla_citations: ParlaCitationSource[] | null;
		open_data_citations: OpenDataCitationSource[] | null;
	}): void;
	visibleInfoMessage: VisibleChatInfoMessage;
	showInfoMessage(infoMessage: VisibleChatInfoMessage): void;
	deactivateExternalTools(): void;
}

export const externalChatTools: ChatTool[] = [
	"webSearch",
	"parla",
	"openData",
	"datawrapper",
];

export const useChatsStore = create<ChatStore>()((set, get) => ({
	isFirstLoad: true,
	isLoading: false,
	chats: [],
	hasMoreChats: true,
	selectedChatTools: [],
	selectedLlmModel: "mistral-small",
	visibleInfoMessage: null,

	setSelectedLlmModel(model: LlmModel) {
		set({ selectedLlmModel: model });
	},

	resetToDefaultChatTools() {
		get().showInfoMessage(null);
		set({ selectedChatTools: [] });
	},

	toggleChatTool(tool: ChatTool) {
		const { selectedChatTools, visibleInfoMessage } = get();

		if (selectedChatTools.includes(tool)) {
			const remainingSelected = selectedChatTools.filter(
				(active) => active !== tool,
			);
			set({ selectedChatTools: remainingSelected });

			const hasRemainingExternalTool = remainingSelected.some((active) =>
				externalChatTools.includes(active),
			);
			if (
				visibleInfoMessage?.type === "historyScoped" &&
				!hasRemainingExternalTool
			) {
				get().showInfoMessage(null);
			}
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

			// Drop "XY wurde deaktiviert" info if tool gets reactivated
			const currentInfoMessage = get().visibleInfoMessage;
			if (currentInfoMessage?.type === "toolDeactivated") {
				const remainingTools = currentInfoMessage.tools.filter(
					(deactivatedTool) => deactivatedTool !== tool,
				);
				set({
					visibleInfoMessage:
						remainingTools.length > 0
							? { type: "toolDeactivated", tools: remainingTools }
							: null,
				});
			}

			const currentChat = get().getCurrentChat();
			const hasNonToolMessage = currentChat?.messages.some(
				({ external_tool_context }) => !external_tool_context,
			);
			if (hasNonToolMessage) {
				get().showInfoMessage({ type: "historyScoped" });
			}
		}

		set({ selectedChatTools: [...selectedChatTools, tool] });
	},

	/**
	 * Fetches the user's chats from the database
	 * and their messages and sets them in the store
	 */
	async getChatsFromDb(signal) {
		set({ isLoading: true });

		// Chats are appended oldest-last, so the last loaded chat's
		// id is the cursor for the next (older) page.
		const { chats } = get();
		const cursor = chats.length > 0 ? chats[chats.length - 1].id : null;

		// Clear any existing fetch error when starting a new fetch attempt
		useErrorStore.getState().clearUIError("chats-fetch");

		const chatsFromDb = await getChatsFromDb(cursor, signal);

		set({ hasMoreChats: chatsFromDb.length === CHATS_PAGE_SIZE });

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

		if (!get().hasMoreChats) {
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
	 * Renames the chat with the given id
	 */
	async renameChat(chatId, newName) {
		await renameChatInDb(chatId, newName);

		const updatedChats = get().chats.map((chat) =>
			chat.id === chatId ? { ...chat, name: newName } : chat,
		);

		set({ chats: updatedChats });
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
	 * Creates a message in local store state only (no DB write). Used for
	 * optimistic assistant messages while a response is still streaming in,
	 * since we don't yet know whether the turn will succeed.
	 */
	createPendingMessageInMemory(givenChat, givenMessage) {
		const localMessageId = nextLocalMessageId--;

		const message: ChatMessage = {
			...givenMessage,
			id: localMessageId,
			chat_id: givenChat.id,
			created_at: new Date().toISOString(),
		};

		givenChat.messages.push(message);

		get().updateChats(givenChat);

		return localMessageId;
	},

	/**
	 * Persists a locally-tracked message to the DB (a single insert) and
	 * swaps the local placeholder for the DB-assigned row.
	 */
	async persistPendingMessageToDb(chat, localMessageId, chatMessage) {
		const message = await insertMessageIntoDb(chat.id, chatMessage);

		const messageIndex = chat.messages.findIndex(
			({ id }) => id === localMessageId,
		);
		if (messageIndex === -1) {
			return;
		}

		chat.messages[messageIndex] = message;
		get().updateChats(chat);
	},

	/**
	 * Removes a message from local store state only (no DB call).
	 */
	removePendingMessageFromMemory(chat, messageId) {
		chat.messages = chat.messages.filter(({ id }) => id !== messageId);
		get().updateChats(chat);
	},

	/**
	 * Updates the content of a message in local store state only.
	 * Persistence happens separately once the stream settles
	 * (see `persistPendingMessageToDb` / `removePendingMessageFromMemory`).
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
		const foundMessage = chat.messages.find(({ id }) => id === messageId);
		if (!foundMessage) {
			return;
		}

		foundMessage.content = content;
		foundMessage.citations = citations;
		foundMessage.web_citations = web_citations;
		foundMessage.parla_citations = parla_citations;
		foundMessage.open_data_citations = open_data_citations;
		get().updateChats(chat);
	},

	showInfoMessage(infoMessage: VisibleChatInfoMessage) {
		clearTimeout(visibleInfoMessageTimeout);
		set({ visibleInfoMessage: infoMessage });
		if (infoMessage !== null) {
			visibleInfoMessageTimeout = setTimeout(() => {
				set({ visibleInfoMessage: null });
			}, 20_000);
		}
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
		get().showInfoMessage({
			type: "toolDeactivated",
			tools: activeExternalTools,
		});
	},
}));
