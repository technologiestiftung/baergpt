import { create } from "zustand";
import type { MutableRefObject } from "react";

interface ChatScrollingStore {
	hasUserScrolledUp: boolean;
	setHasUserScrolledUp: (hasUserScrolled: boolean) => void;

	previousScrollTop: number;
	setPreviousScrollTop: (previousScrollTop: number) => void;

	scrollToBottom: (ref: MutableRefObject<HTMLDivElement | null>) => void;
	handleScroll: (ref: MutableRefObject<HTMLDivElement | null>) => void;
}

export const useChatScrollingStore = create<ChatScrollingStore>()(
	(set, get) => ({
		hasUserScrolledUp: false,
		setHasUserScrolledUp: (hasUserScrolled) =>
			set({ hasUserScrolledUp: hasUserScrolled }),

		previousScrollTop: 0,
		setPreviousScrollTop: (previousScrollTop) => set({ previousScrollTop }),

		scrollToBottom: (ref) => {
			const messagesContainer = ref.current;

			if (!messagesContainer) {
				return;
			}

			const { hasUserScrolledUp } = get();

			if (hasUserScrolledUp) {
				return;
			}

			messagesContainer.scrollTop =
				messagesContainer.scrollHeight - messagesContainer.clientHeight;
		},

		handleScroll: (ref: MutableRefObject<HTMLDivElement | null>) => {
			const messagesContainer = ref.current;

			if (!messagesContainer) {
				return;
			}

			const { previousScrollTop, setPreviousScrollTop, setHasUserScrolledUp } =
				get();
			const {
				scrollHeight,
				clientHeight,
				scrollTop: currentScrollTop,
			} = messagesContainer;

			const isScrollPositionCloseToEnd =
				scrollHeight - clientHeight <= currentScrollTop + 1;

			if (isScrollPositionCloseToEnd) {
				setHasUserScrolledUp(false);
				return;
			}

			/**
			 * Only stop auto scrolling to the new message, when user is scrolling towards top.
			 * When the user is scrolling down, there is no need to stop auto scrolling.
			 */
			const hasUserScrolledTowardsTop = previousScrollTop > currentScrollTop;
			if (hasUserScrolledTowardsTop) {
				setHasUserScrolledUp(true);
			}

			setPreviousScrollTop(currentScrollTop);
		},
	}),
);
