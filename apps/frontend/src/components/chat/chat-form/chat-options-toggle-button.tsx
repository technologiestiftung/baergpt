import React, { useState, useRef, useCallback } from "react";
import Content from "../../../content.ts";
import { ChatFormDropdown } from "./chat-form-dropdown.tsx";
import { useChatsStore } from "../../../store/use-chats-store.ts";
import { useClickOutside } from "../../../hooks/use-click-outside.ts";
import type { ChatOptionsDropdownValue } from "../../../common.ts";
import { useTooltipStore } from "../../../store/tooltip-store.ts";
import { McpOptionsDialog } from "./mcp-options-dialog.tsx";
import { showMcpOptionsDialog } from "./mcp-options-dialog.tsx";

export const ChatOptionsToggleButton: React.FC = () => {
	const { selectedChatOptions, toggleChatOption } = useChatsStore();
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);
	const selectButtonRef = useRef<HTMLButtonElement>(null);
	const dropdownRef = useRef<HTMLDivElement>(null);
	const { showTooltip, hideTooltip } = useTooltipStore();

	const chatOptionsItems: {
		label: string;
		value: ChatOptionsDropdownValue;
		description: string;
		ariaLabel: string;
	}[] = [
		{
			label: Content["chat.options.li1.label"],
			value: "baseKnowledge",
			description: Content["chat.options.li1.description"],
			ariaLabel: Content["chat.options.li1.ariaLabel"],
		},
		{
			label: Content["chat.options.li2.label"],
			value: "mcpServer",
			description: Content["chat.options.li2.description"],
			ariaLabel: Content["chat.options.li2.ariaLabel"],
		},
	];

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

	const handleItemClick = (value: ChatOptionsDropdownValue) => {
		if (value === "mcpServer") {
			showMcpOptionsDialog();
			handleClose();
			return;
		}
		toggleChatOption(value);
		handleClose();
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
					className="hover:bg-hellblau-30 text-2xl rounded-3px size-7 flex items-center justify-center focus-visible:outline-default"
					onClick={handleToggleDropdown}
					aria-label={Content["chat.options.toggleButton.tooltip.ariaLabel"]}
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
						<ChatFormDropdown
							items={chatOptionsItems}
							title={Content["chat.options.dropdown.title"]}
							selectedItems={selectedChatOptions}
							onItemClick={handleItemClick}
							isOpen={isDropdownOpen}
							onClose={handleClose}
						/>
					</div>
				)}
			</div>
			<McpOptionsDialog />
		</>
	);
};
