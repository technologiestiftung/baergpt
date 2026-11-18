import { useRef, type KeyboardEvent, type Ref } from "react";

export interface SegmentedControlOption<T extends string> {
	value: T;
	label: string;
	disabled?: boolean;
}

interface SegmentedControlProps<T extends string> {
	options: SegmentedControlOption<T>[];
	value: T;
	onChange: (value: T) => void;
	ariaLabelledBy: string;
	ariaDescribedBy?: string;
	/** Points at the radio that is the control's single Tab stop. */
	selectedRadioRef?: Ref<HTMLButtonElement>;
}

/**
 * Radio group rendered as segments. Roving tabindex: only the selected
 * segment is a Tab stop, ArrowLeft/ArrowRight select and focus a neighbour.
 * ArrowUp/ArrowDown are left to the parent.
 */
export const SegmentedControl = <T extends string>({
	options,
	value,
	onChange,
	ariaLabelledBy,
	ariaDescribedBy,
	selectedRadioRef,
}: SegmentedControlProps<T>) => {
	const radioRefs = useRef<(HTMLButtonElement | null)[]>([]);

	const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
		if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
			return;
		}
		event.preventDefault();
		event.stopPropagation();

		const currentIndex = options.findIndex((option) => option.value === value);
		const step = event.key === "ArrowRight" ? 1 : -1;
		// Skip disabled segments.
		let nextIndex = currentIndex + step;
		while (
			nextIndex >= 0 &&
			nextIndex < options.length &&
			options[nextIndex].disabled
		) {
			nextIndex += step;
		}
		if (nextIndex < 0 || nextIndex >= options.length) {
			return;
		}
		onChange(options[nextIndex].value);
		radioRefs.current[nextIndex]?.focus();
	};

	return (
		<div
			role="radiogroup"
			aria-labelledby={ariaLabelledBy}
			aria-describedby={ariaDescribedBy}
			className="flex rounded-3px border border-hellblau-100 bg-white p-0.5 gap-0.5"
		>
			{options.map((option, index) => {
				const isSelected = option.value === value;
				let segmentClass = "text-dunkelblau-90 hover:bg-hellblau-60";
				if (isSelected) {
					segmentClass = "bg-dunkelblau-90 text-white font-bold";
				} else if (option.disabled) {
					segmentClass = "text-dunkelblau-40 cursor-not-allowed";
				}

				return (
					<button
						key={option.value}
						type="button"
						role="radio"
						aria-checked={isSelected}
						disabled={option.disabled}
						tabIndex={isSelected ? 0 : -1}
						ref={(el) => {
							radioRefs.current[index] = el;
							if (isSelected && selectedRadioRef) {
								if (typeof selectedRadioRef === "function") {
									selectedRadioRef(el);
								} else {
									selectedRadioRef.current = el;
								}
							}
						}}
						onClick={() => onChange(option.value)}
						onKeyDown={handleKeyDown}
						className={`
							flex-1 px-3 py-1.5 rounded-3px text-sm leading-4 text-center
							focus-visible:outline-default
							${segmentClass}
						`}
					>
						{option.label}
					</button>
				);
			})}
		</div>
	);
};
