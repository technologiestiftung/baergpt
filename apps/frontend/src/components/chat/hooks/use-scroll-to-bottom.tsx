import { type MutableRefObject, useEffect } from "react";
import { useChatScrollingStore } from "../../../store/use-chat-scrolling-store.ts";
import { useChatsStore } from "../../../store/use-chats-store.ts";

export function useScrollToBottom(
	ref: MutableRefObject<HTMLDivElement | null>,
) {
	const { chats } = useChatsStore();

	useEffect(() => {
		// Get stable reference via getState() to avoid dependency on unstable selector
		const scrollFn = useChatScrollingStore.getState().scrollToBottom;
		// small delay for scrolling to wait for the DOM to update
		const timer = setTimeout(() => {
			scrollFn(ref);
		}, 1);

		return () => clearTimeout(timer);
	}, [chats, ref]);
}
