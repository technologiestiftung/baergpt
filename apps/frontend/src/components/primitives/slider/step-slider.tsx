import { type KeyboardEvent, type Ref } from "react";

export interface StepSliderOption<T extends string> {
	value: T;
	label: string;
	disabled?: boolean;
}

interface StepSliderProps<T extends string> {
	options: StepSliderOption<T>[];
	value: T;
	onChange: (value: T) => void;
	ariaLabelledBy: string;
	ariaDescribedBy?: string;
	/** Points at the slider, which is the control's single Tab stop. */
	sliderRef?: Ref<HTMLDivElement>;
}

/**
 * Slider with a fixed number of labelled steps (ARIA slider pattern).
 * ArrowLeft/ArrowRight (and Home/End) change the value, disabled steps are
 * skipped. ArrowUp/ArrowDown are left to the parent.
 */
export const StepSlider = <T extends string>({
	options,
	value,
	onChange,
	ariaLabelledBy,
	ariaDescribedBy,
	sliderRef,
}: StepSliderProps<T>) => {
	const currentIndex = Math.max(
		0,
		options.findIndex((option) => option.value === value),
	);
	const firstEnabled = Math.max(
		0,
		options.findIndex((option) => !option.disabled),
	);
	const lastEnabled = Math.max(
		0,
		options.map((option) => !option.disabled).lastIndexOf(true),
	);
	const lastIndex = options.length - 1;

	const select = (index: number) => {
		if (index < 0 || index > lastIndex) {
			return;
		}
		if (options[index].disabled || index === currentIndex) {
			return;
		}
		onChange(options[index].value);
	};

	const move = (step: number) => {
		let next = currentIndex + step;
		while (next >= 0 && next <= lastIndex && options[next].disabled) {
			next += step;
		}
		select(next);
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		switch (event.key) {
			case "ArrowRight":
				move(1);
				break;
			case "ArrowLeft":
				move(-1);
				break;
			case "Home":
				select(firstEnabled);
				break;
			case "End":
				select(lastEnabled);
				break;
			default:
				return;
		}
		event.preventDefault();
		event.stopPropagation();
	};

	return (
		<div
			ref={sliderRef}
			role="slider"
			tabIndex={0}
			aria-labelledby={ariaLabelledBy}
			aria-describedby={ariaDescribedBy}
			aria-orientation="horizontal"
			aria-valuemin={firstEnabled}
			aria-valuemax={lastEnabled}
			aria-valuenow={currentIndex}
			aria-valuetext={options[currentIndex]?.label}
			onKeyDown={handleKeyDown}
			className="relative rounded-3px py-1 focus-visible:outline-default"
		>
			{/* Track and filled part run from the first to the last step centre. */}
			<div
				aria-hidden="true"
				className="absolute left-[12.5%] right-[12.5%] top-[14px] h-1 rounded-full bg-hellblau-100"
			>
				<div
					className="h-full rounded-full bg-dunkelblau-90"
					style={{
						width: `${(currentIndex / Math.max(1, lastIndex)) * 100}%`,
					}}
				/>
			</div>
			<div
				className="relative grid"
				style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}
			>
				{options.map((option, index) => {
					const isSelected = index === currentIndex;
					let labelClass = "text-dunkelblau-90";
					if (isSelected) {
						labelClass = "text-dunkelblau-90 font-bold";
					} else if (option.disabled) {
						labelClass = "text-dunkelblau-40";
					}
					const isFilled = index <= currentIndex && !option.disabled;

					return (
						<div
							key={option.value}
							aria-hidden="true"
							onClick={() => select(index)}
							className={`flex flex-col items-center gap-1.5 text-sm leading-4 ${
								option.disabled ? "cursor-not-allowed" : "cursor-pointer"
							}`}
						>
							<span
								className={`mt-[7px] h-4 w-4 rounded-full border-2 ${
									isFilled
										? "bg-dunkelblau-90 border-dunkelblau-90"
										: "bg-white border-hellblau-100"
								} ${isSelected ? "ring-2 ring-hellblau-100" : ""}`}
							/>
							<span className={labelClass}>{option.label}</span>
						</div>
					);
				})}
			</div>
		</div>
	);
};
