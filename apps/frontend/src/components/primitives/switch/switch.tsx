import React from "react";

interface SwitchProps {
	checked: boolean;
	onChange: (checked: boolean) => void;
	disabled?: boolean;
	id?: string;
	name?: string;
	ariaLabel?: string;
}

export const Switch: React.FC<SwitchProps> = ({
	checked,
	onChange,
	disabled = false,
	id,
	name,
	ariaLabel,
}) => {
	const handleCheckboxChange = () => {
		if (!disabled) {
			onChange(!checked);
		}
	};

	const getBackgroundColor = () => {
		if (disabled && checked) {
			return "bg-dunkelblau-70";
		}
		if (checked) {
			return "bg-dunkelblau-100";
		}
		return "bg-hellblau-50";
	};

	return (
		<>
			<label
				className={`flex select-none items-center ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
			>
				<div className="relative">
					<input
						type="checkbox"
						checked={checked}
						onChange={handleCheckboxChange}
						disabled={disabled}
						id={id}
						name={name}
						aria-label={ariaLabel}
						className="sr-only"
					/>
					<div
						className={`block h-8 w-14 rounded-full ${getBackgroundColor()}`}
					/>
					<div
						className={`dot absolute top-1 h-6 w-6 rounded-full bg-white transition-all duration-200 ${checked ? "left-7" : "left-1"}`}
					/>
				</div>
			</label>
		</>
	);
};
