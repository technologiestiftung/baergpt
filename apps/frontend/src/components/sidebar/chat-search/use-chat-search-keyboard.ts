import { useRef, type KeyboardEvent, type RefObject } from "react";
import type { Chat } from "../../../common";
import type { ChatSearchResult } from "../../../api/chat/search-chats";
import { openChatFromSearch } from "./chat-search-utils";

interface UseChatSearchKeyboardParams {
	query: string;
	hasQuery: boolean;
	isLoading: boolean;
	results: ChatSearchResult[];
	lastChats: Chat[];
	selectedIndex: number;
	moveSelection: (direction: "up" | "down", itemCount: number) => void;
}

interface UseChatSearchKeyboardResult {
	inputRef: RefObject<HTMLInputElement>;
	closeButtonRef: RefObject<HTMLButtonElement>;
	handleInputKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
	handleCloseButtonKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}

export function useChatSearchKeyboard({
	query,
	hasQuery,
	isLoading,
	results,
	lastChats,
	selectedIndex,
	moveSelection,
}: UseChatSearchKeyboardParams): UseChatSearchKeyboardResult {
	const inputRef = useRef<HTMLInputElement>(null);
	const closeButtonRef = useRef<HTMLButtonElement>(null);
	const selectableCount = hasQuery ? results.length : lastChats.length;

	const focusCloseButton = () => {
		closeButtonRef.current?.focus();
	};

	const focusInput = () => {
		inputRef.current?.focus();
	};

	const handleFocusCycleKeyDown = (
		event: KeyboardEvent<HTMLElement>,
		focusOther: () => void,
	): boolean => {
		if (event.key !== "Tab") {
			return false;
		}

		event.preventDefault();
		focusOther();
		return true;
	};

	const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (handleFocusCycleKeyDown(event, focusCloseButton)) {
			return;
		}

		if (isLoading || selectableCount === 0) {
			return;
		}

		if (event.key === "ArrowDown") {
			event.preventDefault();
			moveSelection("down", selectableCount);
			return;
		}

		if (event.key === "ArrowUp") {
			event.preventDefault();
			moveSelection("up", selectableCount);
			return;
		}

		if (event.key === "Enter") {
			event.preventDefault();
			if (hasQuery) {
				const selectedResult = results[selectedIndex];
				if (selectedResult) {
					void openChatFromSearch(
						selectedResult.chat,
						selectedResult.messageId,
						query,
					);
				}
				return;
			}

			const selectedChat = lastChats[selectedIndex];
			if (selectedChat) {
				void openChatFromSearch(selectedChat);
			}
		}
	};

	const handleCloseButtonKeyDown = (
		event: KeyboardEvent<HTMLButtonElement>,
	) => {
		handleFocusCycleKeyDown(event, focusInput);
	};

	return {
		inputRef,
		closeButtonRef,
		handleInputKeyDown,
		handleCloseButtonKeyDown,
	};
}
