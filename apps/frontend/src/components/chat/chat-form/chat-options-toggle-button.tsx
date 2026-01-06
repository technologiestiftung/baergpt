import React, { useState, useRef, useCallback } from "react";
import Content from "../../../content.ts";
import { ChatFormDropdown } from "./chat-form-dropdown.tsx";
import { useChatsStore } from "../../../store/use-chats-store.ts";
import { useClickOutside } from "../../../hooks/use-click-outside.ts";
import type { ChatOption } from "../../../common.ts";

export const ChatOptionsToggleButton: React.FC = () => {
	const { selectedChatOptions, setSelectedChatOptions } = useChatsStore();
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);
	const buttonRef = useRef<HTMLDivElement>(null);
	const dropdownRef = useRef<HTMLDivElement>(null);

	const chatOptionsItems = [
		{
			label: Content["chat.options.li1.label"],
			value: "baseKnowledge",
			description: Content["chat.options.li1.description"],
			ariaLabel: Content["chat.options.li1.ariaLabel"],
		},
	];

	const handleItemClick = (value: string) => {
		if (selectedChatOptions.includes(value as ChatOption)) {
			setSelectedChatOptions(
				selectedChatOptions.filter((item) => item !== value),
			);
		} else {
			setSelectedChatOptions([...selectedChatOptions, value as ChatOption]);
		}
	};

	const handleToggleDropdown = () => {
		setIsDropdownOpen(!isDropdownOpen);
	};

	const handleClose = useCallback(() => {
		setIsDropdownOpen(false);
	}, []);

	useClickOutside(isDropdownOpen, handleClose, [buttonRef, dropdownRef]);

	return (
		<div className="relative" ref={buttonRef}>
			<button
				type="button"
				className="hover:bg-hellblau-30 text-2xl rounded-3px size-7 flex items-center justify-center focus-visible:outline-default"
				onClick={handleToggleDropdown}
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
					/>
				</div>
			)}
		</div>
	);
};
