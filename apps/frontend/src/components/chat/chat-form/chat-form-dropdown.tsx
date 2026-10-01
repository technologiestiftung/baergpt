import { useId, useRef } from "react";
import Content from "../../../content";
import type { LlmModel } from "../../../common";
import { useDropdownKeyboard } from "../../../hooks/use-dropdown-keyboard";
import { Switch } from "../../primitives/switch/switch";
import { config } from "../../../config";

// Referenced by the toggle button's aria-controls,
// so screen readers can tie the button to the listbox it opens.
export const LLM_MODEL_DROPDOWN_ID = "llm-model-dropdown";

interface ChatFormDropdownProps<T extends LlmModel> {
	title: string;
	items: {
		label: string;
		value: T;
		description: string;
		ariaLabel: string;
	}[];
	selectedItems: T[];
	onItemClick: (value: T) => void;
	isOpen: boolean;
	onClose: () => void;
	isExtendedThinkingEnabled: boolean;
	onExtendedThinkingChange: (isEnabled: boolean) => void;
}

export const ChatFormDropdown = <T extends LlmModel>({
	items,
	title,
	selectedItems,
	onItemClick,
	isOpen,
	onClose,
	isExtendedThinkingEnabled,
	onExtendedThinkingChange,
}: ChatFormDropdownProps<T>) => {
	const titleId = useId();
	const extendedThinkingSwitchRef = useRef<HTMLInputElement>(null);
	const isExtendedThinkingAllowed = config.featureFlagExtendedThinkingAllowed;

	const { optionButtonRefs, handleKeyDown } = useDropdownKeyboard({
		items,
		isOpen,
		onClose,
		onItemClick: (item) => onItemClick(item.value),
		navigateWithTab: true,
		trailingItemRef: extendedThinkingSwitchRef,
		onTrailingItemActivate: () =>
			onExtendedThinkingChange(!isExtendedThinkingEnabled),
	});

	return (
		<div
			className={`
				z-50 absolute bottom-full rounded-3px min-w-[323px] mb-2 
				left-1/2 -translate-x-48 sm:left-auto sm:right-0 sm:translate-x-0 whitespace-nowrap
				bg-hellblau-30 border border-hellblau-50 p-1 
				focus-visible:outline-default shadow-md`}
			onKeyDown={handleKeyDown}
		>
			<div
				id={titleId}
				className="pt-2 pb-1 px-3 text-dunkelblau-65 text-sm leading-4"
			>
				{title}
			</div>
			<ul
				id={LLM_MODEL_DROPDOWN_ID}
				className="flex flex-col"
				role="listbox"
				aria-labelledby={titleId}
			>
				{items.map((item, index) => {
					const isSelected = selectedItems.includes(item.value);

					return (
						<li key={item.value} role="presentation">
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
								className="flex items-center justify-between w-full px-3 pt-2 pb-3 text-left gap-6 hover:bg-hellblau-60 focus-visible:bg-hellblau-60 focus-visible:outline-default rounded-3px"
								onClick={() => onItemClick(item.value)}
								aria-label={item.ariaLabel}
								role="option"
								aria-selected={isSelected}
							>
								<div>
									<div className="text-sm leading-6 text-dunkelblau-90 font-bold">
										{item.label}
									</div>
									<div className="text-dunkelblau-65 text-xs leading-3">
										{item.description}
									</div>
								</div>

								<img
									src="/icons/check-active-icon.svg"
									alt={Content["chat.options.selected.icon.imgAlt"]}
									width={24}
									height={24}
									className={`${isSelected ? "block" : "hidden"}`}
								/>
							</button>
						</li>
					);
				})}
			</ul>
			{isExtendedThinkingAllowed && (
				<>
					<div className="mx-3 h-[0.5px] bg-hellblau-100 justify-self-center " />
					<div className="flex gap-4 items-center justify-between px-3 pb-2 pt-2.5">
						<div className="flex flex-col gap-2">
							<div className="text-sm leading-4 text-dunkelblau-90">
								{Content["chat.llmModel.dropdown.li4.label"]}
							</div>
							<p className="text-xs leading-4 text-dunkelblau-65 max-w-[233px] w-full whitespace-normal">
								{Content["chat.llmModel.dropdown.li4.description"]}
							</p>
						</div>
						<Switch
							ref={extendedThinkingSwitchRef}
							checked={isExtendedThinkingEnabled}
							ariaLabel={Content["chat.llmModel.dropdown.li4.ariaLabel"]}
							onChange={onExtendedThinkingChange}
						/>
					</div>
				</>
			)}
		</div>
	);
};
