import React, { type RefObject } from "react";
import Content from "../../../content.ts";
import { useDropdownKeyboard } from "../../../hooks/use-dropdown-keyboard.ts";
import {
	type GroupingOption,
	useHistoryGroupByStore,
} from "../../../store/use-history-group-by-store.ts";

const options: GroupingOption[] = ["date", "none"];

interface HistoryGroupBySubmenuProps {
	isOpen: boolean;
	onClose: () => void;
	onItemSelect: () => void;
	groupByButtonRef: RefObject<HTMLButtonElement | null>;
	variant?: "flyout" | "inline";
}

export const HistoryGroupBySubmenu: React.FC<HistoryGroupBySubmenuProps> = ({
	isOpen,
	onClose,
	onItemSelect,
	groupByButtonRef,
	variant = "flyout",
}) => {
	const { groupBy, setGroupBy } = useHistoryGroupByStore();

	const handleSelect = (option: GroupingOption) => {
		setGroupBy(option);
		onItemSelect();
	};

	const closeAndRefocusTrigger = () => {
		onClose();
		if (variant === "flyout") {
			groupByButtonRef.current?.focus();
		}
	};

	const { optionButtonRefs, handleKeyDown } = useDropdownKeyboard({
		items: options,
		isOpen,
		onClose: closeAndRefocusTrigger,
		onItemClick: handleSelect,
		closeOnArrowLeft: true,
		navigateWithTab: true,
	});

	return (
		<div
			className={
				variant === "flyout"
					? "p-1 rounded-3px bg-hellblau-30 shadow-md min-w-max"
					: "flex flex-col"
			}
			onKeyDown={handleKeyDown}
			role="menu"
			aria-label={Content["chatHistory.groupBy.dropdown.label"]}
		>
			{variant === "inline" && (
				<>
					<button
						type="button"
						className="flex items-center gap-1 w-full px-3 py-2 text-left hover:bg-hellblau-60 focus-visible:bg-hellblau-60 focus-visible:outline-default rounded-3px"
						onClick={closeAndRefocusTrigger}
					>
						<img
							src="/icons/chevron-right-icon.svg"
							alt=""
							width={20}
							height={20}
							className="rotate-180"
							aria-hidden="true"
						/>
						<span className="text-sm leading-5 text-dunkelblau-80">
							{Content["chatHistory.groupBy.submenu.back"]}
						</span>
					</button>
					<div role="separator" className="px-1.5 py-0.5">
						<div className="h-px bg-hellblau-100" />
					</div>
				</>
			)}
			<ul role="none" className="flex flex-col">
				{options.map((option, index) => {
					const isSelected = groupBy === option;

					return (
						<li key={option} role="none">
							<button
								type="button"
								ref={(el) => {
									if (el) {
										optionButtonRefs.current.set(index, el);
									} else {
										optionButtonRefs.current.delete(index);
									}
								}}
								className="flex items-center justify-between w-full px-3 py-2 text-left gap-2 hover:bg-hellblau-60 focus-visible:bg-hellblau-60 focus-visible:outline-default rounded-3px"
								onClick={() => handleSelect(option)}
								role="menuitemradio"
								aria-checked={isSelected}
							>
								<span className="text-sm leading-5 text-dunkelblau-80 whitespace-nowrap">
									{Content[`chatHistory.groupBy.options.${option}`]}
								</span>
								<img
									src="/icons/check-active-icon.svg"
									alt=""
									width={20}
									height={20}
									aria-hidden="true"
									className={isSelected ? "block" : "hidden"}
								/>
							</button>
						</li>
					);
				})}
			</ul>
		</div>
	);
};
