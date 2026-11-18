import {
	type KeyboardEvent,
	type PointerEvent,
	type Ref,
	useRef,
	useState,
} from "react";

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

	const trackRef = useRef<HTMLDivElement>(null);
	// Position (0..1) of the thumb while dragging; null when it rests on a step.
	const [dragPosition, setDragPosition] = useState<number | null>(null);
	// Ref mirror so pointermove does not depend on a re-render after pointerdown.
	const isDragging = useRef(false);

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

	const dragTo = (event: PointerEvent<HTMLDivElement>) => {
		const rect = trackRef.current?.getBoundingClientRect();
		if (!rect || rect.width === 0) {
			return;
		}
		const position = Math.min(
			1,
			Math.max(0, (event.clientX - rect.left) / rect.width),
		);
		const minPosition = firstEnabled / Math.max(1, lastIndex);
		const maxPosition = lastEnabled / Math.max(1, lastIndex);
		setDragPosition(Math.min(maxPosition, Math.max(minPosition, position)));
		// Keep the value (and the hint) in sync with the nearest step.
		const nearest = Math.round(position * lastIndex);
		select(Math.min(lastEnabled, Math.max(firstEnabled, nearest)));
	};

	const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
		event.currentTarget.setPointerCapture(event.pointerId);
		isDragging.current = true;
		dragTo(event);
	};

	const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
		if (isDragging.current) {
			dragTo(event);
		}
	};

	const endDrag = () => {
		isDragging.current = false;
		setDragPosition(null);
	};

	const thumbPosition = dragPosition ?? currentIndex / Math.max(1, lastIndex);

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
			{/* Track and thumb run from the first to the last step centre. */}
			<div
				ref={trackRef}
				aria-hidden="true"
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={endDrag}
				onPointerCancel={endDrag}
				className="absolute z-10 left-[12.5%] right-[12.5%] top-1 h-[30px] cursor-pointer touch-none"
			>
				<div className="absolute inset-x-0 top-[10px] h-1 rounded-full bg-hellblau-100">
					<div
						className="h-full rounded-full bg-dunkelblau-90"
						style={{ width: `${thumbPosition * 100}%` }}
					/>
				</div>
				<span
					className="absolute top-[3px] h-4 w-4 -translate-x-1/2 rounded-full border-2 border-dunkelblau-90 bg-dunkelblau-90 ring-2 ring-hellblau-100"
					style={{ left: `${thumbPosition * 100}%` }}
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

					return (
						<div
							key={option.value}
							aria-hidden="true"
							onClick={() => select(index)}
							className={`flex flex-col items-center pt-[30px] text-sm leading-4 ${
								option.disabled ? "cursor-not-allowed" : "cursor-pointer"
							}`}
						>
							<span className={labelClass}>{option.label}</span>
						</div>
					);
				})}
			</div>
		</div>
	);
};
