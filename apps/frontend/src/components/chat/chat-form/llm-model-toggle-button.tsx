import React, { useRef, useState, useCallback } from "react";
import { ChevronIcon } from "../../primitives/icons/chevron-icon";
import { useClickOutside } from "../../../hooks/use-click-outside";
import { ChatFormDropdown } from "./chat-form-dropdown";
import Content from "../../../content";
import { useChatsStore } from "../../../store/use-chats-store";
import type { LlmModel } from "../../../common";

export const LlmModelToggleButton: React.FC = () => {
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);
	const buttonRef = useRef<HTMLDivElement>(null);
	const dropdownRef = useRef<HTMLDivElement>(null);
	const { selectedLlmModel, setSelectedLlmModel } = useChatsStore();

	const llmModelItems = [
		{
			label: Content["chat.llmModel.dropdown.li1.labelExtended"],
			value: "mistral-small",
			description: Content["chat.llmModel.dropdown.li1.description"],
			ariaLabel: Content["chat.llmModel.dropdown.li1.ariaLabel"],
		},
		{
			label: Content["chat.llmModel.dropdown.li2.labelExtended"],
			value: "mistral-large",
			description: Content["chat.llmModel.dropdown.li2.description"],
			ariaLabel: Content["chat.llmModel.dropdown.li2.ariaLabel"],
		},
	];

	const handleItemClick = (value: string) => {
		setSelectedLlmModel(value as LlmModel);
		setIsDropdownOpen(false);
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
				className="hover:bg-hellblau-30 px-3 py-1.5 rounded-3px flex gap-2 items-center justify-center focus-visible:outline-default"
				onClick={handleToggleDropdown}
			>
				<span className="text-sm leading-5 text-dunkelblau-80">
					{selectedLlmModel === "mistral-small"
						? Content["chat.llmModel.dropdown.li1.label"]
						: Content["chat.llmModel.dropdown.li2.label"]}
				</span>

				<ChevronIcon color="dunkelblau-80" direction="down" />
			</button>
			{isDropdownOpen && (
				<div ref={dropdownRef}>
					<ChatFormDropdown
						items={llmModelItems}
						title={Content["chat.llmModel.dropdown.title"]}
						selectedItems={[selectedLlmModel]}
						onItemClick={handleItemClick}
						className="right-0 whitespace-nowrap"
					/>
				</div>
			)}
		</div>
	);
};
