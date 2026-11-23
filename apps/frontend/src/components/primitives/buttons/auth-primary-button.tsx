import React from "react";
import type { ButtonProps } from "./button-types";

export const AuthPrimaryButton: React.FC<ButtonProps> = ({
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
			flex w-full h-11 px-5 items-center justify-center rounded-3px
			bg-dunkelblau-100 text-hellblau-30 text-base leading-6 font-normal
			hover:bg-dunkelblau-90 disabled:bg-dunkelblau-40 disabled:hover:bg-dunkelblau-40
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
