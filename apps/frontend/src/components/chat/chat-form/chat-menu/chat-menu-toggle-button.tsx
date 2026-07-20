import React, { useState, useRef, useCallback } from "react";
import Content from "../../../../content.ts";
import { CHAT_TOOLS_MENU_ID, ChatMenuSection } from "./chat-menu-section.tsx";
import { useClickOutside } from "../../../../hooks/use-click-outside.ts";
import { useTooltipStore } from "../../../../store/tooltip-store.ts";

export const ChatMenuToggleButton: React.FC = () => {
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
			content: Content["chat.options.toggleButton.tooltip"],
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
			<div>
				<button
					ref={selectButtonRef}
					type="button"
					className="hover:bg-hellblau-30 text-2xl rounded-3px size-7 flex items-center justify-center focus-visible:outline-default"
					onClick={handleToggleDropdown}
					aria-label={Content["chat.options.toggleButton.tooltip.ariaLabel"]}
					aria-haspopup="menu"
					aria-expanded={isDropdownOpen}
					aria-controls={CHAT_TOOLS_MENU_ID}
					onMouseEnter={handleShowTooltip}
					onMouseLeave={hideTooltip}
					onFocus={handleShowTooltip}
					onBlur={hideTooltip}
				>
					<img
						src="icons/plus-dark-blue-icon.svg"
						alt={Content["plusIcon.imgAlt"]}
						width={24}
						height={24}
					/>
				</button>
				{isDropdownOpen && (
					<div ref={dropdownRef}>
						<ChatMenuSection isOpen={isDropdownOpen} onClose={handleClose} />
					</div>
				)}
			</div>
		</>
	);
};
