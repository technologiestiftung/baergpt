import React from "react";
import type { ButtonProps } from "./button-types";

export const PrimaryButton: React.FC<ButtonProps> = ({
	onClick,
	disabled,
	type = "button",
	ariaLabel,
	title,
	children,
}) => {
	return (
		<button
			className={`
			flex rounded-3px h-9 w-fit items-center px-2.5 gap-2
			 bg-white border border-dunkelblau-200 
			 hover:bg-dunkelblau-100 hover:text-white 
			 focus-visible:outline-default`}
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
