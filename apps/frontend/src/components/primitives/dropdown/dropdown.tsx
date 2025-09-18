import React, { FormEvent, useState, useEffect, useMemo } from "react";

interface DropdownProps {
	id: string;
	className?: string;
	options: readonly string[];
	defaultOption?: string;
	emptyLabel?: string;
	required?: boolean;
}

export const Dropdown: React.FC<DropdownProps> = ({
	id,
	className = "",
	options,
	defaultOption,
	emptyLabel = "",
	required = false,
}) => {
	const validDefaultOption = useMemo(() => {
		return defaultOption && options.includes(defaultOption)
			? defaultOption
			: "";
	}, [defaultOption, options]);

	const [value, setValue] = useState<string>(validDefaultOption);

	// Update state when defaultOption or options change
	useEffect(() => {
		setValue(validDefaultOption);
	}, [validDefaultOption]);

	const handleInput = (event: FormEvent<HTMLSelectElement>) => {
		setValue(event.currentTarget.value);
	};

	return (
		<label htmlFor={id} className="grid cursor-pointer">
			<svg
				className="relative z-10 col-start-1 row-start-1 self-center justify-self-end right-2 pointer-events-none"
				width="16"
				height="16"
				viewBox="0 0 16 16"
				fill="none"
				aria-hidden="true"
			>
				<path
					d="M14.5916 5.25911L7.92497 11.9258L1.2583 5.25911L2.44163 4.07578L7.92497 9.55911L13.4083 4.07578L14.5916 5.25911Z"
					fill="#030812"
				/>
			</svg>
			<select
				id={id}
				name={id}
				required={required}
				value={value}
				onChange={handleInput}
				className={`
                    peer appearance-none col-start-1 row-start-1 cursor-pointer
                    border border-schwarz-40 rounded-3px p-2.5
                    focus-visible:outline-default hover:bg-hellblau-30
                    ${className}
                `}
			>
				{emptyLabel && <option value="">{emptyLabel}</option>}
				{options.map((option) => (
					<option key={option} value={option}>
						{option}
					</option>
				))}
			</select>
		</label>
	);
};
