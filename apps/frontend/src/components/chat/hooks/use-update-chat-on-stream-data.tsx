import { type MutableRefObject, useEffect } from "react";
import { useChatsStore } from "../../../store/use-chats-store.ts";
import type { UIMessage } from "ai";

export function useUpdateChatOnStreamData({
	assistantMessageIdRef,
	messages,
}: {
	assistantMessageIdRef: MutableRefObject<number | null>;
	messages: UIMessage[];
}) {
	useEffect(() => {
		const chat = useChatsStore.getState().getCurrentChat();
		const assistantMessageId = assistantMessageIdRef.current;

		if (!chat || !assistantMessageId) {
			return;
		}

		const lastMessage = messages.at(-1);
		if (!lastMessage || lastMessage.role !== "assistant") {
			return;
		}

		const textContent = getTextFromMessage(lastMessage);
		if (!textContent) {
			return;
		}

		useChatsStore.getState().updateMessage({
			chat,
			messageId: assistantMessageId,
			content: textContent,
			citations: null,
		});
	}, [messages, assistantMessageIdRef]);
}

function getTextFromMessage(message: UIMessage): string {
	return message.parts
		.filter(
			(part): part is { type: "text"; text: string } => part.type === "text",
		)
		.map((part) => part.text)
		.join("");
}
