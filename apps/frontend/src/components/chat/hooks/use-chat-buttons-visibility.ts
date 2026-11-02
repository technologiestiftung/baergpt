import type { ChatMessage } from "../../../common.ts";
import { useChatsStore } from "../../../store/use-chats-store.ts";
import { useInferenceLoadingStatusStore } from "../../../store/use-inference-loading-status-store.ts";

export function useChatButtonsVisibility(message: ChatMessage) {
	const { status } = useInferenceLoadingStatusStore();
	const { getCurrentChat } = useChatsStore();

	const isLastMessage = message.id === getCurrentChat()?.messages.at(-1)?.id;
	const hasChatButtons = !isLastMessage || status === "idle";

	return { isLastMessage, hasChatButtons };
}
