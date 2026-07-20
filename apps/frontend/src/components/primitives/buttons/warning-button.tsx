import React from "react";
import type { ButtonProps } from "./button-types";

export const WarningButton: React.FC<ButtonProps> = ({
	onClick,
	disabled,
	type = "button",
	ariaLabel,
	title,
	children,
	testId,
}) => {
	return (
		<button
			className="p-2 rounded-[3px] w-fit flex-shrink-0 self-end md:self-center text-white text-sm leading-5 font-normal bg-warning-100 hover:bg-warning-85 focus-visible:outline-default"
			onClick={onClick}
			disabled={disabled}
			type={type}
			aria-label={ariaLabel}
			title={title}
			data-testid={testId}
		>
			{children}
		</button>
	);
};
