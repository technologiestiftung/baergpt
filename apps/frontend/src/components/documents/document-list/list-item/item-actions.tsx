import React from "react";

interface ItemActionsProps {
	isSelectedForChat: boolean;
	children: React.ReactNode;
}

export const ItemActions: React.FC<ItemActionsProps> = ({
	isSelectedForChat,
	children,
}) => {
	// Collapsed with w-0 instead of hidden so the buttons stay keyboard-focusable
	const collapseUntilHover = isSelectedForChat
		? ""
		: [
				"hoverable:w-0 hoverable:overflow-hidden",
				"hoverable:group-hover:w-auto hoverable:group-hover:overflow-visible",
				"hoverable:group-focus-within:w-auto hoverable:group-focus-within:overflow-visible",
				"hoverable:has-[[aria-expanded=true]]:w-auto hoverable:has-[[aria-expanded=true]]:overflow-visible",
			].join(" ");

	return (
		<div className={`flex items-center gap-x-1 ${collapseUntilHover}`}>
			{children}
		</div>
	);
};
