import { type MutableRefObject, useEffect } from "react";
import { useChatScrollingStore } from "../../../store/use-chat-scrolling-store.ts";
import { useChatsStore } from "../../../store/use-chats-store.ts";

export function useScrollToBottom(
	ref: MutableRefObject<HTMLDivElement | null>,
) {
	const { chats } = useChatsStore();
	const { scrollToBottom } = useChatScrollingStore();

	useEffect(() => {
		// small delay for scrolling to wait for the DOM to update
		const timer = setTimeout(() => {
			scrollToBottom(ref);
		}, 1);

		return () => clearTimeout(timer);
	}, [chats, scrollToBottom, ref]);
}
