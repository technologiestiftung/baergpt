import React from "react";

interface SwitchProps {
	checked: boolean;
	onChange: (checked: boolean) => void;
	disabled?: boolean;
	id?: string;
	name?: string;
	ariaLabel?: string;
}

export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
	({ checked, onChange, disabled = false, id, name, ariaLabel }, ref) => {
		const handleCheckboxChange = () => {
			if (!disabled) {
				onChange(!checked);
			}
		};

		const getTrackColor = () => {
			if (disabled) {
				return checked ? "bg-dunkelblau-70" : "bg-dunkelblau-30";
			}
			if (checked) {
				return "bg-aktiv-blau-100 group-hover/switch:bg-aktiv-blau-95";
			}
			return "bg-dunkelblau-40 group-hover/switch:bg-dunkelblau-50";
		};

		return (
			<label
				className={`group/switch flex select-none items-center ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
			>
				<div className="relative h-6 w-[42px]">
					<input
						ref={ref}
						type="checkbox"
						role="switch"
						checked={checked}
						aria-checked={checked}
						onChange={handleCheckboxChange}
						disabled={disabled}
						id={id}
						name={name}
						aria-label={ariaLabel}
						className="peer sr-only"
					/>
					<div
						className={`block h-full w-full rounded-full transition-colors duration-200 ${getTrackColor()} peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-default`}
					/>
					<div
						className={`dot absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white transition-all duration-200 ${checked ? "left-[21px]" : "left-[3px]"}`}
					/>
				</div>
			</label>
		);
	},
);

Switch.displayName = "Switch";
