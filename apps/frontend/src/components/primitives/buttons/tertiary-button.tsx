import React from "react";
import type { ButtonProps } from "./button-types";

export const TertiaryButton: React.FC<ButtonProps> = ({
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
			hover:bg-hellblau-100 disabled:text-dunkelblau-40
			focus-visible:outline-default text-sm leading-5 font-normal `}
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
