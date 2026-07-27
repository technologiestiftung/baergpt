import type { Chat } from "../../../common";
import { getMessages } from "../../../api/message/get-messages";
import { useCurrentChatIdStore } from "../../../store/current-chat-id-store";
import { useChatsStore } from "../../../store/use-chats-store";
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

export async function openChatFromSearch(chat: Chat): Promise<void> {
	const { chats, syncChats } = useChatsStore.getState();
	const loadedChat = chats.find((storedChat) => storedChat.id === chat.id);

	if (!loadedChat) {
		const messages = await getMessages(chat.id, new AbortController().signal);
		syncChats([{ ...chat, messages }]);
	}

	useCurrentChatIdStore.getState().setCurrentChatId(chat.id);
	closeChatSearchDialog()();
}
