import { create } from "zustand";
import type { ChatWithMessages, NewChatMessage } from "../common";
import { useCurrentChatIdStore } from "./current-chat-id-store.ts";
import { getChats as getChatsFromDb } from "../api/chat/get-chats.ts";
import { insertChat as insertChatIntoDb } from "../api/chat/insert-chat.ts";
import { deleteChat as deleteChatFromDb } from "../api/chat/delete-chat.ts";
import { getMessages as getMessagesFromDb } from "../api/message/get-messages.ts";
import { insertMessage as insertMessageIntoDb } from "../api/message/insert-message.ts";
import { updateMessage as updateMessageInDb } from "../api/message/update-message.ts";
import { useErrorStore } from "./error-store.ts";

let debounceTimeout: ReturnType<typeof setTimeout>;

interface ChatStore {
	isFirstLoad: boolean;
	isLoading: boolean;
	chats: ChatWithMessages[];
	selectedChatOptions: string[];
	setSelectedChatOptions(options: string[]): void;
	updateChats(givenChat: ChatWithMessages): void;
	getChatsFromDb(signal: AbortSignal): Promise<void>;
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
	}): void;
}

export const useChatsStore = create<ChatStore>()((set, get) => ({
	isFirstLoad: true,
	isLoading: false,
	chats: [],
	selectedChatOptions: [],

	setSelectedChatOptions(options: string[]) {
		set({ selectedChatOptions: options });
	},

	/**
	 * Fetches the user's chats from the database
	 * and their messages and sets them in the store
	 */
	async getChatsFromDb(signal) {
		set({ isLoading: true });

		// Clear any existing fetch error when starting a new fetch attempt
		useErrorStore.getState().clearUIError("chats-fetch");

		const chats = await getChatsFromDb(signal);

		const promises = chats.map(async (chat) => {
			const messages = await getMessagesFromDb(chat.id, signal);
			return { ...chat, messages };
		});

		const chatsWithMessages = await Promise.all(promises);

		set({ chats: chatsWithMessages });

		if (get().isFirstLoad) {
			set({ isFirstLoad: false });
		}

		set({ isLoading: false });
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
	updateMessage: ({ chat, messageId, content, citations }) => {
		clearTimeout(debounceTimeout);

		const foundMessage = chat.messages.find(
			(message) => message.id === messageId,
		);
		if (!foundMessage) {
			return;
		}

		foundMessage.content = content;
		foundMessage.citations = citations;

		get().updateChats(chat);

		debounceTimeout = setTimeout(async () => {
			await updateMessageInDb(messageId, { content, citations });
		}, 300);
	},
}));
