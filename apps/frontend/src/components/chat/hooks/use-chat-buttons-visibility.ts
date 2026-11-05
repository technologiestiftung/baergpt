import type { ChatMessage } from "../../../common.ts";
import { useChatsStore } from "../../../store/use-chats-store.ts";
import { useInferenceLoadingStatusStore } from "../../../store/use-inference-loading-status-store.ts";

export function useChatButtonsVisibility(message: ChatMessage) {
	// Select only booleans, so a streamed delta or status change does not
	// re-render messages it does not affect.
	const isLastMessage = useChatsStore(
		(state) => state.getCurrentChat()?.messages.at(-1)?.id === message.id,
	);
	const isGenerating = useInferenceLoadingStatusStore(
		(state) => isLastMessage && state.isLoading(),
	);

	return { isLastMessage, hasChatButtons: !isGenerating };
}
