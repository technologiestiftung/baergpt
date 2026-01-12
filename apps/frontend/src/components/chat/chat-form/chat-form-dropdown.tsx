import { useRef, type KeyboardEvent } from "react";
import Content from "../../../content";
import type { LlmModel, ChatOption } from "../../../common";
import { useFocusOnOpen } from "./hooks/use-focus-on-open.tsx";

interface ChatFormDropdownProps<T extends LlmModel | ChatOption> {
	title: string;
	items: {
		label: string;
		value: T;
		description: string;
		ariaLabel: string;
	}[];
	selectedItems: T[];
	onItemClick: (value: T) => void;
	className?: string;
	isOpen: boolean;
	onClose: () => void;
}

export const ChatFormDropdown = <T extends LlmModel | ChatOption>({
	items,
	title,
	selectedItems,
	onItemClick,
	className,
	isOpen,
	onClose,
}: ChatFormDropdownProps<T>) => {
	const optionButtonRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
	const containerRef = useRef<HTMLDivElement>(null);

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
		const previousIndex = Math.abs((currentIndex - 1) % optionButtons.length);
		optionButtons[previousIndex].focus();
	};

	// Handle keyboard navigation
	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		const optionButtons = Array.from(optionButtonRefs.current.values());
		const currentIndex = optionButtons.findIndex(
			(button) => button === document.activeElement,
		);

		switch (event.key) {
			case "Escape":
			case "Tab":
			case "Shift+Tab":
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
				onItemClick(items[currentIndex].value);
				break;

			default:
				break;
		}
	};

	return (
		<div
			ref={containerRef}
			className={`z-50 absolute bottom-full rounded-3px bg-white border border-hellblau-50 pt-3 focus-visible:outline-default shadow-md min-w-[280px] mb-1 ${className}`}
			onKeyDown={handleKeyDown}
			role="listbox"
		>
			<div className="pb-3 px-4 border-b border-hellblau-50 text-dunkelblau-80 text-sm leading-6">
				{title}
			</div>
			<ul className="flex flex-col">
				{items.map((item, index) => {
					const isSelected = selectedItems.includes(item.value);
					return (
						<li key={item.value}>
							<button
								type="button"
								ref={(el) => {
									// set ref for each option button
									if (el) {
										optionButtonRefs.current.set(index, el);
									} else {
										optionButtonRefs.current.delete(index);
									}
								}}
								className="flex items-center justify-between w-full px-4 py-3 text-left gap-6 hover:bg-hellblau-30 focus-visible:outline-default rounded-3px"
								onClick={() => onItemClick(item.value)}
								aria-label={item.ariaLabel}
								role="option"
								aria-selected={isSelected}
							>
								<div>
									<div
										className={`text-sm leading-6 ${isSelected ? "text-aktiv-blau-100" : "text-dunkelblau-80"}`}
									>
										{item.label}
									</div>
									<div className="text-dunkelblau-50 text-xs leading-5">
										{item.description}
									</div>
								</div>

								<img
									src="/icons/check-active-icon.svg"
									alt={Content["chat.options.selected.icon.imgAlt"]}
									width={20}
									height={20}
									className={`${isSelected ? "block" : "hidden"}`}
								/>
							</button>
						</li>
					);
				})}
			</ul>
		</div>
	);
};
