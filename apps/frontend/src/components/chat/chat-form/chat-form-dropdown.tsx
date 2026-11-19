import { useId, useRef } from "react";
import Content from "../../../content";
import type { LlmModel } from "../../../common";
import { useDropdownKeyboard } from "../../../hooks/use-dropdown-keyboard";
import { StepSlider } from "../../primitives/slider/step-slider";
import { config } from "../../../config";
import {
	REASONING_EFFORTS,
	type ReasoningEffort,
} from "../../../store/use-reasoning-effort-store";

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
	reasoningEffort: ReasoningEffort;
	onReasoningEffortChange: (reasoningEffort: ReasoningEffort) => void;
	/** The selected model always reasons, so "Aus" is greyed out. */
	disableNoReasoning?: boolean;
}

const reasoningOptions = REASONING_EFFORTS.map((value) => ({
	value,
	label: Content[`chat.llmModel.reasoningEffort.${value}`],
}));

export const ChatFormDropdown = <T extends LlmModel>({
	items,
	title,
	selectedItems,
	onItemClick,
	isOpen,
	onClose,
	reasoningEffort,
	onReasoningEffortChange,
	disableNoReasoning = false,
}: ChatFormDropdownProps<T>) => {
	const titleId = useId();
	const reasoningLabelId = useId();
	const reasoningHintId = useId();
	const reasoningRadioRef = useRef<HTMLDivElement>(null);
	const isExtendedThinkingAllowed = config.featureFlagExtendedThinkingAllowed;

	const { optionButtonRefs, handleKeyDown } = useDropdownKeyboard({
		items,
		isOpen,
		onClose,
		onItemClick: (item) => onItemClick(item.value),
		navigateWithTab: true,
		// The slider is the control's single Tab stop.
		trailingItemRef: reasoningRadioRef,
	});

	return (
		<div
			className={`
				z-50 absolute bottom-full rounded-3px min-w-[323px] mb-2 
				left-1/2 -translate-x-60 sm:left-auto sm:right-0 sm:translate-x-0 whitespace-nowrap
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
					<div className="mx-3 h-[0.5px] bg-hellblau-100" />
					<div className="flex flex-col gap-2 px-3 pb-2 pt-2.5">
						<div
							id={reasoningLabelId}
							className="text-sm leading-4 text-dunkelblau-65"
						>
							{Content["chat.llmModel.reasoningEffort.label"]}
						</div>
						<StepSlider
							options={reasoningOptions.map((option) => ({
								...option,
								disabled: disableNoReasoning && option.value === "none",
							}))}
							value={reasoningEffort}
							onChange={onReasoningEffortChange}
							ariaLabelledBy={reasoningLabelId}
							ariaDescribedBy={reasoningHintId}
							sliderRef={reasoningRadioRef}
						/>
						<p
							id={reasoningHintId}
							className="text-xs leading-4 text-dunkelblau-65 w-0 min-w-full whitespace-normal"
						>
							{Content[`chat.llmModel.reasoningEffort.${reasoningEffort}.hint`]}
							{disableNoReasoning &&
								`${Content["chat.llmModel.reasoningEffort.alwaysReasons.hint"]}`}
						</p>
					</div>
				</>
			)}
		</div>
	);
};
