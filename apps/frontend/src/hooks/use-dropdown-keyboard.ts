import { useRef, type KeyboardEvent, type RefObject } from "react";
import { useFocusOnOpen } from "../components/chat/chat-form/hooks/use-focus-on-open";

interface UseDropdownKeyboardProps<T> {
	items: T[];
	isOpen: boolean;
	onClose: () => void;
	onItemClick: (value: T) => void;
	closeOnArrowLeft?: boolean;
	navigateWithTab?: boolean; // navigate with tab instead of closing the dropdown
	trailingItemRef?: RefObject<HTMLElement | null>; // Extra focusable after the option list
	onTrailingItemActivate?: () => void;
}

interface UseDropdownKeyboardReturn {
	optionButtonRefs: RefObject<Map<number, HTMLButtonElement>>;
	handleKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
}

export function useDropdownKeyboard<T>({
	items,
	isOpen,
	onClose,
	onItemClick,
	closeOnArrowLeft = false,
	navigateWithTab = false,
	trailingItemRef,
	onTrailingItemActivate,
}: UseDropdownKeyboardProps<T>): UseDropdownKeyboardReturn {
	const optionButtonRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

	useFocusOnOpen(isOpen, optionButtonRefs);

	const selectNextOption = (
		currentIndex: number,
		focusables: HTMLElement[],
	) => {
		if (focusables.length === 0) {
			return;
		}
		const nextIndex = (currentIndex + 1) % focusables.length;
		focusables[nextIndex].focus();
	};

	const selectPreviousOption = (
		currentIndex: number,
		focusables: HTMLElement[],
	) => {
		if (focusables.length === 0) {
			return;
		}
		const previousIndex =
			currentIndex <= 0 ? focusables.length - 1 : currentIndex - 1;
		focusables[previousIndex].focus();
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		const optionButtons = Array.from(optionButtonRefs.current.values());
		const trailingItem = trailingItemRef?.current ?? null;
		const focusables: HTMLElement[] = trailingItem
			? [...optionButtons, trailingItem]
			: optionButtons;
		const currentIndex = focusables.findIndex(
			(focusable) => focusable === document.activeElement,
		);

		const consume = () => {
			event.preventDefault();
			event.stopPropagation();
		};

		switch (event.key) {
			case "Escape":
				event.preventDefault();
				onClose();
				break;

			case "Tab":
				if (!navigateWithTab) {
					event.preventDefault();
					onClose();
					break;
				}
				consume();
				if (event.shiftKey) {
					selectPreviousOption(currentIndex, focusables);
				} else {
					selectNextOption(currentIndex, focusables);
				}
				break;

			case "ArrowLeft":
				if (closeOnArrowLeft) {
					event.preventDefault();
					onClose();
				}
				break;

			case "ArrowDown":
				consume();
				selectNextOption(currentIndex, focusables);
				break;

			case "ArrowUp":
				consume();
				selectPreviousOption(currentIndex, focusables);
				break;

			case "Enter":
				consume();
				if (currentIndex === -1) {
					break;
				}
				if (focusables[currentIndex] === trailingItem) {
					onTrailingItemActivate?.();
					break;
				}
				onItemClick(items[currentIndex]);
				break;

			default:
				break;
		}
	};

	return {
		optionButtonRefs,
		handleKeyDown,
	};
}
