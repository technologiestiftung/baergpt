import React from "react";
import type { ButtonProps } from "./button-types";

export const SecondaryButton: React.FC<ButtonProps> = ({
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
			className={`
			flex rounded-3px h-9 w-fit items-center px-2.5 gap-2
			bg-hellblau-60 hover:bg-hellblau-100 
			disabled:text-dunkelblau-40 disabled:hover:bg-hellblau-60
			focus-visible:outline-default text-dunkelblau-100
			${className}`}
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
