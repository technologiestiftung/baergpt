import type { ChatMessage } from "../../../common.ts";
import { useChatsStore } from "../../../store/use-chats-store.ts";
import { useInferenceLoadingStatusStore } from "../../../store/use-inference-loading-status-store.ts";

export function useChatButtonsVisibility(message: ChatMessage) {
	const status = useInferenceLoadingStatusStore((state) => state.status);
	// Select only this boolean, so a streamed delta in another message does
	// not re-render this one.
	const isLastMessage = useChatsStore(
		(state) => state.getCurrentChat()?.messages.at(-1)?.id === message.id,
	);
	const hasChatButtons = !isLastMessage || status === "idle";

	return { isLastMessage, hasChatButtons };
}
