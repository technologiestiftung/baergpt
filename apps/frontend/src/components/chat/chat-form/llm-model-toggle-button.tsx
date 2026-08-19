import React, { useRef, useState, useCallback } from "react";
import { ChevronIcon } from "../../primitives/icons/chevron-icon";
import { useClickOutside } from "../../../hooks/use-click-outside";
import { ChatFormDropdown } from "./chat-form-dropdown";
import Content from "../../../content";
import { useChatsStore } from "../../../store/use-chats-store";
import type { LlmModel } from "../../../common";
import { config } from "../../../config";

export const LlmModelToggleButton: React.FC = () => {
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);
	const selectButtonRef = useRef<HTMLButtonElement>(null);
	const dropdownRef = useRef<HTMLDivElement>(null);
	const { selectedLlmModel, setSelectedLlmModel } = useChatsStore();

	const llmModelItems = [
		{
			label: Content["chat.llmModel.dropdown.li1.labelExtended"],
			value: "mistral-small" as const,
			description: Content["chat.llmModel.dropdown.li1.description"],
			ariaLabel: Content["chat.llmModel.dropdown.li1.ariaLabel"],
		},
		{
			label: Content["chat.llmModel.dropdown.li2.labelExtended"],
			value: "mistral-medium" as const,
			description: Content["chat.llmModel.dropdown.li2.description"],
			ariaLabel: Content["chat.llmModel.dropdown.li2.ariaLabel"],
		},
		...(config.featureFlagGlm52Allowed
			? [
					{
						label: Content["chat.llmModel.dropdown.li3.labelExtended"],
						value: "glm-5-2" as const,
						description: Content["chat.llmModel.dropdown.li3.description"],
						ariaLabel: Content["chat.llmModel.dropdown.li3.ariaLabel"],
					},
				]
			: []),
	];

	const selectedLlmModelLabel: Record<LlmModel, string> = {
		"mistral-small": Content["chat.llmModel.dropdown.li1.label"],
		"mistral-medium": Content["chat.llmModel.dropdown.li2.label"],
		"glm-5-2": Content["chat.llmModel.dropdown.li3.label"],
	};

	const handleClose = useCallback(() => {
		setIsDropdownOpen(false);
		selectButtonRef.current?.focus();
	}, []);

	const handleItemClick = (value: LlmModel) => {
		setSelectedLlmModel(value);
		handleClose();
	};

	const handleToggleDropdown = () => {
		setIsDropdownOpen(!isDropdownOpen);
	};

	useClickOutside(isDropdownOpen, handleClose, [selectButtonRef, dropdownRef]);

	return (
		<div className="relative">
			<button
				ref={selectButtonRef}
				type="button"
				className="hover:bg-hellblau-30 px-3 py-1.5 rounded-3px flex gap-2 items-center justify-center focus-visible:outline-default"
				onClick={handleToggleDropdown}
			>
				<span className="text-sm leading-5 text-dunkelblau-80">
					{selectedLlmModelLabel[selectedLlmModel]}
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
						isOpen={isDropdownOpen}
						onClose={handleClose}
					/>
				</div>
			)}
		</div>
	);
};
