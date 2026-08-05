import React, { useState, useRef, useCallback } from "react";
import { useClickOutside } from "../../../hooks/use-click-outside.ts";
import { useTooltipStore } from "../../../store/tooltip-store.ts";
import Content from "../../../content.ts";
import { SettingsIcon } from "../../primitives/icons/settings-icon.tsx";
import { CheckIcon } from "../../primitives/icons/check-icon.tsx";
import {
	type GroupingOption,
	useHistoryGroupByStore,
} from "../../../store/use-history-group-by-store.ts";

const options: GroupingOption[] = ["none", "date"];

export function HistoryGroupByDropdown() {
	const { groupBy, setGroupBy } = useHistoryGroupByStore();
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);
	const selectButtonRef = useRef<HTMLButtonElement>(null);
	const dropdownRef = useRef<HTMLDivElement>(null);
	const { showTooltip, hideTooltip } = useTooltipStore();

	const handleShowTooltip = (
		event: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>,
	) => {
		if (isDropdownOpen) {
			return;
		}

		showTooltip({
			event,
			content: Content["chatHistory.groupBy.dropdown.tooltip"],
			offset: { top: -34, right: -28 },
		});
	};

	const handleToggleDropdown = () => {
		hideTooltip();
		setIsDropdownOpen(!isDropdownOpen);
	};

	const handleClose = useCallback(() => {
		setIsDropdownOpen(false);
		selectButtonRef.current?.focus();
	}, []);

	useClickOutside(isDropdownOpen, handleClose, [selectButtonRef, dropdownRef]);

	return (
		<>
			<div className="relative">
				<button
					ref={selectButtonRef}
					type="button"
					className="hover:bg-dunkelblau-90 text-2xl rounded-3px size-7 flex items-center justify-center focus-visible:outline-default"
					aria-expanded={isDropdownOpen}
					aria-haspopup="menu"
					aria-label={Content["chatHistory.groupBy.dropdown.ariaLabel"]}
					onClick={handleToggleDropdown}
					onMouseEnter={handleShowTooltip}
					onMouseLeave={hideTooltip}
					onFocus={handleShowTooltip}
					onBlur={hideTooltip}
				>
					<SettingsIcon />
				</button>
				{isDropdownOpen && (
					<div
						ref={dropdownRef}
						className="absolute right-0 z-10  min-w-max flex flex-col bg-white rounded-3px text-dunkelblau-80"
					>
						<span
							id="group-by-label"
							className="text-dunkelblau-40 py-1 pl-2 pr-2"
						>
							{Content["chatHistory.groupBy.dropdown.label"]}
						</span>
						<div
							className="flex flex-col"
							role="menu"
							aria-labelledby="group-by-label"
						>
							{options.map((option) => (
								<button
									key={option}
									className="flex w-full justify-between hover:bg-hellblau-50 pl-2 pr-2 py-1 focus-visible:outline-default rounded-3px"
									aria-checked={groupBy === option}
									role="menuitemradio"
									onClick={() => {
										setGroupBy(option);
										handleClose();
									}}
								>
									{Content[`chatHistory.groupBy.options.${option}`]}{" "}
									{groupBy === option && <CheckIcon />}
								</button>
							))}
						</div>
					</div>
				)}
			</div>
		</>
	);
}
