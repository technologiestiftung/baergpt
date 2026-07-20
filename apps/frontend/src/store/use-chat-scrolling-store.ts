import { create } from "zustand";
import type { MutableRefObject } from "react";

const SCROLL_THRESHOLD = 32;
const USER_MESSAGE_SELECTOR = '[data-testid="user-message-markdown-container"]';

type OutputRef = MutableRefObject<HTMLOutputElement | null>;
type DivRef = MutableRefObject<HTMLDivElement | null>;

interface ChatScrollingStore {
	containerRef: OutputRef;
	contentRef: DivRef;
	spacerRef: DivRef;
	isAtBottom: boolean;
	isReservingSpace: boolean;
	updateIsAtBottom: () => void;
	adjustSpacer: () => void;
	scrollNewMessageToTop: () => void;
	scrollToBottom: (behavior?: "auto" | "smooth") => void;
}

export const useChatScrollingStore = create<ChatScrollingStore>()(
	(set, get) => ({
		containerRef: { current: null },
		contentRef: { current: null },
		spacerRef: { current: null },
		isAtBottom: true,
		isReservingSpace: false,

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
