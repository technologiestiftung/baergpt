import { useEffect, useLayoutEffect, useRef } from "react";
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
	 * Jump to the last message when a chat is opened or switched.
	 * The small timeout lets the newly selected chat's messages render first.
	 */
	useEffect(() => {
		const timer = setTimeout(() => scrollToBottom("auto"), 1);
		return () => clearTimeout(timer);
	}, [currentChatId, scrollToBottom]);

	/**
	 * Scroll a newly sent user message to the top of the viewport.
	 * Skipped on a chat switch, where the effect above already jumps to the bottom.
	 */
	useLayoutEffect(() => {
		const hasChatIdChanged = previousChatId.current !== currentChatId;
		const hasNewUserMessage =
			userMessageCount > previousUserMessageCount.current;
		previousChatId.current = currentChatId;
		previousUserMessageCount.current = userMessageCount;

		if (!hasChatIdChanged && hasNewUserMessage) {
			scrollNewMessageToTop();
		}
	}, [currentChatId, userMessageCount, scrollNewMessageToTop]);

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
	}, [currentChatId, adjustSpacer, updateIsAtBottom]);

	return {
		messagesContainerRef: containerRef,
		contentRef,
		spacerRef,
		isAtBottom,
		onScroll: updateIsAtBottom,
	};
}
