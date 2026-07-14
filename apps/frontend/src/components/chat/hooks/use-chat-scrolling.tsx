import { useLayoutEffect, useRef } from "react";
import { useChatScrollingStore } from "../../../store/use-chat-scrolling-store.ts";

export function useChatScrolling(
	currentChatId: number | null,
	userMessageCount: number,
) {
	const {
		containerRef,
		contentRef,
		spacerRef,
		isAtBottom,
		updateIsAtBottom,
		adjustSpacer,
		scrollNewMessageToTop,
		scrollToBottom,
	} = useChatScrollingStore();

	const previousChatId = useRef(currentChatId);
	const previousUserMessageCount = useRef(userMessageCount);

	/**
	 * Jump to bottom when chat ID changes or scroll up when a new user message is added.
	 */
	useLayoutEffect(() => {
		const hasChatIdChanged = previousChatId.current !== currentChatId;
		const hasNewUserMessage =
			userMessageCount > previousUserMessageCount.current;

		if (hasChatIdChanged) {
			scrollToBottom("auto");
			previousChatId.current = currentChatId;
			return;
		}

		if (hasNewUserMessage) {
			scrollNewMessageToTop();
			previousUserMessageCount.current = userMessageCount;
		}
	}, [currentChatId, userMessageCount, scrollToBottom, scrollNewMessageToTop]);

	/**
	 * Adjust the spacer and update isAtBottom state when content changes.
	 */
	useLayoutEffect(() => {
		const content = contentRef.current;
		if (!content) {
			return () => {};
		}
		const observer = new ResizeObserver(() => {
			adjustSpacer();
			updateIsAtBottom();
		});
		observer.observe(content);
		return () => observer.disconnect();
	}, [currentChatId, contentRef, adjustSpacer, updateIsAtBottom]);

	return {
		messagesContainerRef: containerRef,
		contentRef,
		spacerRef,
		isAtBottom,
		onScroll: updateIsAtBottom,
		scrollToBottom: () => scrollToBottom(),
	};
}
