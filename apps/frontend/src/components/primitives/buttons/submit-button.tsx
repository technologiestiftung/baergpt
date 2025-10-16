import React from "react";
import type { ButtonProps } from "./button-types";

export const SubmitButton: React.FC<ButtonProps> = ({
	onClick,
	disabled,
	ariaLabel,
	title,
	children,
	className = "",
}) => {
	return (
		<button
			type="submit"
			onClick={onClick}
			disabled={disabled}
			aria-label={ariaLabel}
			title={title}
			className={`flex gap-x-2 items-center w-fit p-2 rounded-[3px] text-sm leading-5 font-normal text-hellblau-30 bg-dunkelblau-100 disabled:bg-dunkelblau-40 hover:bg-dunkelblau-80 focus-visible:outline-default ${className}`}
		>
			{children}
		</button>
	);
};
