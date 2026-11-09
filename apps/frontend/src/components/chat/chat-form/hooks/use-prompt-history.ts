import { type KeyboardEvent, useEffect, useRef } from "react";
import { useChatsStore } from "../../../../store/use-chats-store.ts";
import { useCurrentChatIdStore } from "../../../../store/current-chat-id-store.ts";

interface UsePromptHistoryParams {
	content: string;
	setContent: (content: string) => void;
}

interface UsePromptHistoryResult {
	handlePromptHistoryKeyDown: (
		event: KeyboardEvent<HTMLTextAreaElement>,
	) => boolean;
	resetPromptHistory: () => void;
}

const getPrompts = () =>
	useChatsStore
		.getState()
		.getCurrentChat()
		?.messages.filter((message) => message.role === "user")
		.map((message) => message.content)
		.filter((prompt, index, all) => prompt !== all[index - 1]) ?? [];

const singleLineHeightFallback = 24;

export const getTextareaLineHeight = (textarea: HTMLTextAreaElement) =>
	Number.parseFloat(getComputedStyle(textarea).lineHeight) ||
	singleLineHeightFallback;

const isSingleVisualLine = (textarea: HTMLTextAreaElement) =>
	textarea.scrollHeight <= getTextareaLineHeight(textarea) * 1.5;

export function usePromptHistory({
	content,
	setContent,
}: UsePromptHistoryParams): UsePromptHistoryResult {
	const { currentChatId } = useCurrentChatIdStore();

	const historyIndex = useRef<number | null>(null);
	const draft = useRef("");

	const resetPromptHistory = () => {
		historyIndex.current = null;
	};

	useEffect(() => {
		// A recalled prompt belongs to the previous chat and must not be sent here
		if (historyIndex.current !== null) {
			setContent(draft.current);
		}
		resetPromptHistory();
	}, [currentChatId]);

	const showPrompt = (textarea: HTMLTextAreaElement, prompt: string) => {
		// setContent only moves the caret once the content actually changes
		if (prompt === content) {
			textarea.setSelectionRange(content.length, content.length);
			return;
		}
		setContent(prompt);
	};

	const handlePromptHistoryKeyDown = (
		event: KeyboardEvent<HTMLTextAreaElement>,
	) => {
		const hasModifier =
			event.shiftKey || event.altKey || event.ctrlKey || event.metaKey;
		if (hasModifier || event.nativeEvent.isComposing) {
			return false;
		}

		const textarea = event.currentTarget;
		const { selectionStart, selectionEnd, value } = textarea;
		if (selectionStart !== selectionEnd) {
			return false;
		}

		const isBrowsing = historyIndex.current !== null;
		const isCaretAtEnd = selectionEnd === value.length;

		if (
			event.key === "ArrowUp" &&
			(selectionStart === 0 || (isBrowsing && isSingleVisualLine(textarea)))
		) {
			const prompts = getPrompts();
			const currentIndex = historyIndex.current ?? prompts.length;
			if (currentIndex === 0) {
				return false;
			}
			if (historyIndex.current === null) {
				draft.current = content;
			}
			event.preventDefault();
			historyIndex.current = currentIndex - 1;
			showPrompt(textarea, prompts[historyIndex.current]);
			return true;
		}

		if (
			event.key === "ArrowDown" &&
			historyIndex.current !== null &&
			(isCaretAtEnd || isSingleVisualLine(textarea))
		) {
			event.preventDefault();
			const prompts = getPrompts();
			const nextIndex = historyIndex.current + 1;
			if (nextIndex < prompts.length) {
				historyIndex.current = nextIndex;
				showPrompt(textarea, prompts[nextIndex]);
			} else {
				historyIndex.current = null;
				showPrompt(textarea, draft.current);
			}
			return true;
		}

		return false;
	};

	return { handlePromptHistoryKeyDown, resetPromptHistory };
}
