import React from "react";
import { ButtonProps } from "./button-types";

export const ChatButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
	(
		{
			onClick,
			className = "",
			disabled,
			type = "button",
			onMouseEnter,
			onMouseLeave,
			ariaLabel,
			title,
			children,
			testId,
		},
		ref,
	) => {
		return (
			<button
				className={`
				flex gap-0.5 rounded-[3px] pr-1.5 p-1 h-8
				sm:w-fit hover:bg-hellblau-50 focus-visible:outline-default 
				justify-center items-center text-sm leading-5 text-dunkelblau-80 
				disabled:text-dunkelblau-40 disabled:hover:bg-transparent 
				${className}`}
				disabled={disabled}
				onClick={onClick}
				type={type}
				aria-label={ariaLabel}
				title={title}
				ref={ref}
				onMouseEnter={onMouseEnter}
				onMouseLeave={onMouseLeave}
				data-testid={testId}
			>
				{children}
			</button>
		);
	},
);

ChatButton.displayName = "ChatButton";
