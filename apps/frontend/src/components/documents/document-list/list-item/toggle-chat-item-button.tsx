import React from "react";
import Content from "../../../../content.ts";

interface ToggleChatItemButtonProps {
	handleToggleChatItem: () => void;
	isSelectedForChat: boolean;
}

export const ToggleChatItemButton: React.FC<ToggleChatItemButtonProps> = ({
	handleToggleChatItem,
	isSelectedForChat,
}) => {
	const label = isSelectedForChat
		? Content["documentsList.RemoveFromChat"]
		: Content["documentsList.AddToChat"];

	return (
		<button
			className={`
			flex rounded-3px w-fit items-center px-2 gap-1.5 text-sm leading-5 font-normal focus-visible:outline-default h-8
			${
				isSelectedForChat
					? "text-dunkelblau-100 bg-hellblau-100 hover:bg-mittelblau-70"
					: "bg-dunkelblau-100 text-hellblau-30 hover:bg-dunkelblau-90 group-hover:opacity-100 focus-within:opacity-100 opacity-0 transition-opacity duration-150"
			}`}
			type="button"
			onClick={handleToggleChatItem}
			aria-label={label}
		>
			{label}
		</button>
	);
};
