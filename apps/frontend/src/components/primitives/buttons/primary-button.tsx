import React from "react";
import type { ButtonProps } from "./button-types";

export const PrimaryButton: React.FC<ButtonProps> = ({
	onClick,
	disabled,
	type = "button",
	ariaLabel,
	title,
	hasIcon,
	children,
}) => {
	return (
		<button
			className={`
			flex rounded-3px w-fit items-center pl-2 gap-1.5
			 bg-dunkelblau-100 text-hellblau-30 text-sm leading-5 font-normal
			 hover:bg-dunkelblau-90 disabled:bg-dunkelblau-40 disabled:hover:bg-dunkelblau-40
			 focus-visible:outline-default h-9 ${hasIcon === "right" ? "pr-1" : "pr-2"}
			 ${hasIcon === "left" ? "pl-1" : "pl-2"}`}
			disabled={disabled}
			onClick={onClick}
			type={type}
			aria-label={ariaLabel}
			title={title}
		>
			{children}
		</button>
	);
};
