import { useEffect, useRef, type KeyboardEvent, type RefObject } from "react";
import Content from "../../../content";
import type { LlmModel, ChatOption } from "../../../common";

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
	selectButtonRef?: RefObject<HTMLButtonElement>;
}

export const ChatFormDropdown = <T extends LlmModel | ChatOption>({
	items,
	title,
	selectedItems,
	onItemClick,
	className,
	isOpen,
	onClose,
	selectButtonRef,
}: ChatFormDropdownProps<T>) => {
	const optionButtonRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (isOpen) {
			// set focus on first item when dropdown opens
			optionButtonRefs.current.get(0)?.focus();
		}
	}, [isOpen]);

	// Handle keyboard navigation
	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		const optionButtons = Array.from(optionButtonRefs.current.values());
		const currentIndex = optionButtons.findIndex(
			(button) => button === document.activeElement,
		);

		switch (event.key) {
			case "Escape":
				event.preventDefault();
				onClose();
				break;

			case "Tab":
				// Check if focus moved outside after Tab
				setTimeout(() => {
					const activeElement = document.activeElement;
					const isWithinDropdown =
						containerRef.current?.contains(activeElement);
					const isWithinButton = selectButtonRef?.current === activeElement;

					if (!isWithinDropdown && !isWithinButton) {
						onClose();
					}
				}, 0);
				break;

			case "ArrowDown":
			case "ArrowUp": {
				event.preventDefault();
				if (optionButtons.length === 0) {
					break;
				}

				const direction = event.key === "ArrowDown" ? 1 : -1;
				const nextIndex =
					(currentIndex + direction + optionButtons.length) %
					optionButtons.length;
				optionButtons[nextIndex]?.focus();
				break;
			}

			case "Enter":
				if (currentIndex !== -1) {
					event.preventDefault();
					onItemClick(items[currentIndex].value);
				}
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
