import { create } from "zustand";
import type { MutableRefObject } from "react";

const SCROLL_THRESHOLD = 32;
const USER_MESSAGE_SELECTOR = '[data-testid="user-message-markdown-container"]';

type OutputRef = MutableRefObject<HTMLOutputElement | null>;
type DivRef = MutableRefObject<HTMLDivElement | null>;

export type PendingScrollToMessage = {
	messageId: number;
	query: string;
};

interface ChatScrollingStore {
	containerRef: OutputRef;
	contentRef: DivRef;
	spacerRef: DivRef;
	isAtBottom: boolean;
	isReservingSpace: boolean;
	pendingScrollToMessage: PendingScrollToMessage | null;
	setPendingScrollToMessage: (target: PendingScrollToMessage | null) => void;
	updateIsAtBottom: () => void;
	adjustSpacer: () => void;
	scrollNewMessageToTop: () => void;
	scrollToBottom: (behavior?: "auto" | "smooth") => void;
	scrollToMessage: (messageId: number, query: string) => void;
}

export const useChatScrollingStore = create<ChatScrollingStore>()(
	(set, get) => ({
		containerRef: { current: null },
		contentRef: { current: null },
		spacerRef: { current: null },
		isAtBottom: true,
		isReservingSpace: false,
		pendingScrollToMessage: null,

		setPendingScrollToMessage: (target) => {
			set({ pendingScrollToMessage: target });
		},

		updateIsAtBottom: () => {
			const container = get().containerRef.current;
			if (!container) {
				return;
			}
			const contentBottom = getContentHeight(
				container,
				get().spacerRef.current,
			);
			set({
				isAtBottom:
					container.scrollTop + container.clientHeight >=
					contentBottom - SCROLL_THRESHOLD,
			});
		},

		/**
		 * While reserving space, keep enough room below the last user message
		 * for it to sit at the top of the viewport; shrinks to zero as the answer
		 * fills the view.
		 */
		adjustSpacer: () => {
			const { containerRef, spacerRef, isReservingSpace } = get();
			const container = containerRef.current;
			const spacer = spacerRef.current;
			if (!container || !spacer) {
				return;
			}
			const lastUserMessageTop = isReservingSpace
				? getLastUserMessageTop(container)
				: null;
			if (lastUserMessageTop === null) {
				spacer.style.height = "0px";
				return;
			}
			const contentBelowMessage =
				getContentHeight(container, spacer) - lastUserMessageTop;
			spacer.style.height = `${Math.max(0, container.clientHeight - contentBelowMessage)}px`;
		},

		scrollNewMessageToTop: () => {
			const container = get().containerRef.current;
			if (!container) {
				return;
			}
			set({ isReservingSpace: true, isAtBottom: false });
			get().adjustSpacer();
			const top = getLastUserMessageTop(container);
			if (top !== null) {
				container.scrollTo({ top, behavior: "smooth" });
			}
		},

		scrollToBottom: (behavior = "smooth") => {
			const { containerRef, spacerRef } = get();
			const container = containerRef.current;
			if (!container) {
				return;
			}
			set({ isReservingSpace: false });
			if (spacerRef.current) {
				spacerRef.current.style.height = "0px";
			}
			container.scrollTo({
				top:
					getContentHeight(container, spacerRef.current) -
					container.clientHeight,
				behavior,
			});
			set({ isAtBottom: true });
		},

		scrollToMessage: (messageId, query) => {
			const container = get().containerRef.current;
			if (!container) {
				return;
			}

			const messageElement = container.querySelector<HTMLElement>(
				`[data-message-id="${messageId}"]`,
			);
			if (!messageElement) {
				set({ pendingScrollToMessage: null });
				return;
			}

			set({ isReservingSpace: false, isAtBottom: false });
			const spacer = get().spacerRef.current;
			if (spacer) {
				spacer.style.height = "0px";
			}

			const matchRange = findTextRange(messageElement, query.trim());
			if (matchRange) {
				scrollRangeIntoContainerCenter(container, matchRange);
			} else {
				messageElement.scrollIntoView({ block: "center", behavior: "smooth" });
			}

			set({ pendingScrollToMessage: null });
			get().updateIsAtBottom();
		},
	}),
);

function getLastUserMessageTop(container: HTMLOutputElement) {
	const userMessages = container.querySelectorAll<HTMLElement>(
		USER_MESSAGE_SELECTOR,
	);
	const lastUserMessage = userMessages[userMessages.length - 1];
	if (!lastUserMessage) {
		return null;
	}
	return (
		lastUserMessage.getBoundingClientRect().top -
		container.getBoundingClientRect().top +
		container.scrollTop
	);
}

function getContentHeight(
	container: HTMLOutputElement,
	spacer: HTMLDivElement | null,
) {
	return container.scrollHeight - (spacer?.offsetHeight ?? 0);
}

/**
 * Finds the first case-insensitive occurrence of `query` in the element's
 * text nodes. Returns a Range covering that match, or null if not found.
 */
function findTextRange(root: HTMLElement, query: string): Range | null {
	if (!query) {
		return null;
	}

	const lowerQuery = query.toLowerCase();
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	let node = walker.nextNode();

	while (node) {
		const text = node.textContent ?? "";
		const matchIndex = text.toLowerCase().indexOf(lowerQuery);
		if (matchIndex !== -1) {
			const range = document.createRange();
			range.setStart(node, matchIndex);
			range.setEnd(node, matchIndex + query.length);
			return range;
		}
		node = walker.nextNode();
	}

	return null;
}

function scrollRangeIntoContainerCenter(
	container: HTMLOutputElement,
	range: Range,
) {
	const rangeRect = range.getBoundingClientRect();
	const containerRect = container.getBoundingClientRect();
	const rangeTopInContainer =
		rangeRect.top - containerRect.top + container.scrollTop;
	const targetTop =
		rangeTopInContainer - container.clientHeight / 2 + rangeRect.height / 2;

	container.scrollTo({
		top: Math.max(0, targetTop),
		behavior: "smooth",
	});
}
