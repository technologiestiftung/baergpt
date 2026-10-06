import { useEffect, useLayoutEffect, useRef } from "react";
import { useChatScrollingStore } from "../../../store/use-chat-scrolling-store.ts";
import { useChatsStore } from "../../../store/use-chats-store.ts";

export function useChatScrolling(
	currentChatId: number | null,
	userMessageCount: number,
) {
	const {
		containerRef,
		contentRef,
		spacerRef,
		isAtBottom,
		pendingScrollToMessage,
		updateIsAtBottom,
		adjustSpacer,
		scrollNewMessageToTop,
		scrollToBottom,
		scrollToMessage,
	} = useChatScrollingStore();

	const { visibleInfoMessage } = useChatsStore();

	const previousChatId = useRef(currentChatId);
	const previousUserMessageCount = useRef(userMessageCount);
	const latestUserMessageCount = useRef(userMessageCount);
	latestUserMessageCount.current = userMessageCount;

	//Jump to the bottom when a transient info message (tool deactivated / history scoped) appears.
	useLayoutEffect(() => {
		const container = containerRef.current;
		if (!visibleInfoMessage || !container) {
			return () => {};
		}
		scrollToBottom("smooth");
		let isInitialCallback = true;
		const observer = new ResizeObserver(() => {
			if (isInitialCallback) {
				isInitialCallback = false;
				return;
			}
			scrollToBottom("smooth");
		});
		observer.observe(container);
		return () => observer.disconnect();
	}, [visibleInfoMessage, containerRef, scrollToBottom]);

	/**
	 * Jump to the last message when an existing chat is opened or switched.
	 * Skipped when a search result asked us to scroll to a specific message,
	 * and skipped when the chat id changed because it was *just created* by
	 * sending its first message — that case is a new message like any
	 * other and is handled by the "pin to top" effect below instead.
	 * The small timeout lets the newly selected chat's messages render first.
	 * Reads pendingScrollToMessage from getState so clearing it after a
	 * search-scroll does not re-trigger this effect.
	 */
	useEffect(() => {
		if (useChatScrollingStore.getState().pendingScrollToMessage !== null) {
			return () => {};
		}
		if (latestUserMessageCount.current === 1) {
			return () => {};
		}
		const timer = setTimeout(() => scrollToBottom("auto"), 1);
		return () => clearTimeout(timer);
	}, [currentChatId, scrollToBottom]);

	/**
	 * Scroll to a specific message after opening a chat from search.
	 */
	useEffect(() => {
		if (pendingScrollToMessage === null || currentChatId === null) {
			return;
		}
		const { messageId, query } = pendingScrollToMessage;
		scrollToMessage(messageId, query);
	}, [pendingScrollToMessage, currentChatId, scrollToMessage]);

	/**
	 * Scroll a newly sent user message to the top of the viewport.
	 * Skipped on a switch to an *existing* chat, where the effect above
	 * already jumps to the bottom — except when the chat id changed because
	 * it was just created by this very message (its first), which should
	 * still pin to top like any other new message.
	 */
	useLayoutEffect(() => {
		const hasChatIdChanged = previousChatId.current !== currentChatId;
		const hasNewUserMessage =
			userMessageCount > previousUserMessageCount.current;
		previousChatId.current = currentChatId;
		previousUserMessageCount.current = userMessageCount;

		const isFirstMessageInNewChat = hasChatIdChanged && userMessageCount === 1;

		if ((!hasChatIdChanged || isFirstMessageInNewChat) && hasNewUserMessage) {
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
