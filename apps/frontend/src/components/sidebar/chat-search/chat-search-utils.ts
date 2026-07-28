import type { Chat } from "../../../common";
import { getMessages } from "../../../api/message/get-messages";
import { useCurrentChatIdStore } from "../../../store/current-chat-id-store";
import { useChatsStore } from "../../../store/use-chats-store";
import { useChatScrollingStore } from "../../../store/use-chat-scrolling-store";
import Content from "../../../content";
import { isToday, format, isThisYear } from "date-fns";
import { de } from "date-fns/locale";
import { closeChatSearchDialog } from "./chat-search-dialog-controls";

export function removeMarkdownStyling(text: string): string {
	return text.replace(/[#`>*]/g, "");
}

export function formatChatSearchDate(createdAt: string): string {
	const date = new Date(createdAt);
	if (isToday(date)) {
		return Content["chatHistory.today"];
	}
	if (isThisYear(date)) {
		return format(date, "dd. MMM", { locale: de });
	}
	return format(date, "dd.MM.yyyy", { locale: de });
}

let inFlightChatId: number | null = null;

export async function openChatFromSearch(
	chat: Chat,
	messageId?: number,
	query?: string,
): Promise<void> {
	inFlightChatId = chat.id;
	const { chats, syncChats } = useChatsStore.getState();
	const loadedChat = chats.find((storedChat) => storedChat.id === chat.id);
	const targetMessageLoaded =
		loadedChat?.messages.some((m) => m.id === messageId) ?? false;

	if (!loadedChat || !targetMessageLoaded) {
		try {
			const messages = await getMessages(chat.id, new AbortController().signal);
			if (inFlightChatId !== chat.id) {
				return;
			}
			syncChats([{ ...chat, messages }]);
		} catch {
			// keeping the dialog open for retry
			return;
		}
	}

	if (messageId !== undefined) {
		useChatScrollingStore.getState().setPendingScrollToMessage({
			messageId,
			query: query?.trim() ?? "",
		});
	}

	useCurrentChatIdStore.getState().setCurrentChatId(chat.id);
	closeChatSearchDialog();
}
