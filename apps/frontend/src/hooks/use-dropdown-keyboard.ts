import { useRef, type KeyboardEvent, type MutableRefObject } from "react";
import { useFocusOnOpen } from "../components/chat/chat-form/hooks/use-focus-on-open";

interface UseDropdownKeyboardProps<T> {
	items: T[];
	isOpen: boolean;
	onClose: () => void;
	onItemClick: (value: T) => void;
}

interface UseDropdownKeyboardReturn {
	optionButtonRefs: MutableRefObject<Map<number, HTMLButtonElement>>;
	handleKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
}

export function useDropdownKeyboard<T>({
	items,
	isOpen,
	onClose,
	onItemClick,
}: UseDropdownKeyboardProps<T>): UseDropdownKeyboardReturn {
	const optionButtonRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

	useFocusOnOpen(isOpen, optionButtonRefs);

	const selectNextOption = (
		currentIndex: number,
		optionButtons: HTMLButtonElement[],
	) => {
		const nextIndex = (currentIndex + 1) % optionButtons.length;
		optionButtons[nextIndex].focus();
	};

	const selectPreviousOption = (
		currentIndex: number,
		optionButtons: HTMLButtonElement[],
	) => {
		const previousIndex =
			(currentIndex - 1 + optionButtons.length) % optionButtons.length;
		optionButtons[previousIndex].focus();
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		const optionButtons = Array.from(optionButtonRefs.current.values());
		const currentIndex = optionButtons.findIndex(
			(button) => button === document.activeElement,
		);

		switch (event.key) {
			case "Escape":
			case "Tab":
				event.preventDefault();
				onClose();
				break;

			case "ArrowDown":
				event.preventDefault();
				selectNextOption(currentIndex, optionButtons);
				break;

			case "ArrowUp":
				event.preventDefault();
				selectPreviousOption(currentIndex, optionButtons);
				break;

			case "Enter":
				event.preventDefault();
				if (currentIndex !== -1) {
					onItemClick(items[currentIndex]);
				}
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
