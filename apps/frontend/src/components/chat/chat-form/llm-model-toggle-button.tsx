import React, { useRef, useState, useCallback } from "react";
import { ChevronIcon } from "../../primitives/icons/chevron-icon";
import { useClickOutside } from "../../../hooks/use-click-outside";
import { ChatFormDropdown, LLM_MODEL_DROPDOWN_ID } from "./chat-form-dropdown";
import Content from "../../../content";
import {
	useLlmModelStore,
	availableLlmModels,
} from "../../../store/use-llm-model-store";
import { useExtendedThinkingStore } from "../../../store/use-extended-thinking-store";
import type { LlmModel } from "../../../common";

const LLM_MODEL_DROPDOWN_DESCRIPTION_ID = "llm-model-dropdown-description-id";

export const LlmModelToggleButton: React.FC = () => {
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);
	const selectButtonRef = useRef<HTMLButtonElement>(null);
	const dropdownRef = useRef<HTMLDivElement>(null);

	const { selectedLlmModel, setSelectedLlmModel } = useLlmModelStore();
	const { isExtendedThinkingEnabled, setIsExtendedThinkingEnabled } =
		useExtendedThinkingStore();

	const llmModelItems = [
		{
			label: Content["chat.llmModel.dropdown.li1.labelExtended"],
			value: "fast" as const,
			description: Content["chat.llmModel.dropdown.li1.description"],
			ariaLabel: Content["chat.llmModel.dropdown.li1.ariaLabel"],
		},
		{
			label: Content["chat.llmModel.dropdown.li2.labelExtended"],
			value: "precise" as const,
			description: Content["chat.llmModel.dropdown.li2.description"],
			ariaLabel: Content["chat.llmModel.dropdown.li2.ariaLabel"],
		},
		{
			label: Content["chat.llmModel.dropdown.li3.labelExtended"],
			value: "experimental" as const,
			description: Content["chat.llmModel.dropdown.li3.description"],
			ariaLabel: Content["chat.llmModel.dropdown.li3.ariaLabel"],
		},
	].filter(({ value }) => availableLlmModels.includes(value));

	const selectedLlmModelLabel: Record<LlmModel, string> = {
		fast: Content["chat.llmModel.dropdown.li1.label"],
		precise: Content["chat.llmModel.dropdown.li2.label"],
		experimental: Content["chat.llmModel.dropdown.li3.label"],
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
				className={`
					pl-2 pr-1 py-1.5 rounded-3px flex gap-0.5 items-center justify-center
					hover:bg-hellblau-60 focus-visible:outline-default
					${isDropdownOpen && "bg-hellblau-60"}
				`}
				onClick={handleToggleDropdown}
				aria-haspopup="listbox"
				aria-expanded={isDropdownOpen}
				aria-controls={LLM_MODEL_DROPDOWN_ID}
				aria-describedby={LLM_MODEL_DROPDOWN_DESCRIPTION_ID}
			>
				<span className="text-sm leading-5 text-dunkelblau-80">
					{selectedLlmModelLabel[selectedLlmModel]}
				</span>

				<ChevronIcon
					color="dunkelblau-80"
					direction={isDropdownOpen ? "up" : "down"}
				/>
			</button>
			<span id={LLM_MODEL_DROPDOWN_DESCRIPTION_ID} className="sr-only">
				{Content["chat.llmModel.toggleButton.ariaDescription"]}
			</span>
			{isDropdownOpen && (
				<div ref={dropdownRef}>
					<ChatFormDropdown
						items={llmModelItems}
						title={Content["chat.llmModel.dropdown.title"]}
						selectedItems={[selectedLlmModel]}
						onItemClick={handleItemClick}
						isOpen={isDropdownOpen}
						onClose={handleClose}
						isExtendedThinkingEnabled={isExtendedThinkingEnabled}
						onExtendedThinkingChange={setIsExtendedThinkingEnabled}
					/>
				</div>
			)}
		</div>
	);
};
