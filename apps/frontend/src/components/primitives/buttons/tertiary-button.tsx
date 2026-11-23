import React from "react";
import type { ButtonProps } from "./button-types";

interface TertiaryButtonProps extends ButtonProps {
	ref?: React.Ref<HTMLButtonElement>;
}

export const TertiaryButton: React.FC<TertiaryButtonProps> = ({
	ref,
	onClick,
	disabled,
	type = "button",
	ariaLabel,
	title,
	children,
}) => {
	return (
		<button
			ref={ref}
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
