import React, { type ReactNode } from "react";

export interface ButtonProps {
	label?: string | React.ReactNode;
	onClick?: () => void;
	disabled?: boolean;
	type?: "button" | "submit";
	ariaLabel?: string;
	title?: string;
	isLoading?: boolean;
	icon?: React.ReactNode;
	isOutlineVisible?: boolean;
	className?: string;
	children?: string | ReactNode;
	onMouseEnter?: (event: React.MouseEvent<HTMLButtonElement>) => void;
	onMouseLeave?: (event: React.MouseEvent<HTMLButtonElement>) => void;
	testId?: string;
	variant?: "default" | "addToChatButton";
}
