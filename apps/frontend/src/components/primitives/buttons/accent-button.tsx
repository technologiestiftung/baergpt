import React from "react";
import type { ButtonProps } from "./button-types";

export const AccentButton: React.FC<ButtonProps> = ({
	onClick,
	disabled,
	type = "button",
	ariaLabel,
	title,
	children,
	className,
}) => {
	return (
		<button
			className={`px-3 py-2 text-lg leading-7 font-normal h-11 gap-2 rounded-3px
			 text-white bg-dunkelblau-100 border border-dunkelblau-100
			 hover:bg-dunkelblau-90 focus-visible:outline-default ${className}`}
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
