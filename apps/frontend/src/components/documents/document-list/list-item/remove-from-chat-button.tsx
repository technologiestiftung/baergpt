import React from "react";
import Content from "../../../../content.ts";

interface RemoveFromChatButtonProps {
	handleRemoveFromChat: () => void;
}

export const RemoveFromChatButton: React.FC<RemoveFromChatButtonProps> = ({
	handleRemoveFromChat,
}) => {
	return (
		<button
			className="flex rounded-3px w-fit items-center px-2 gap-1.5 text-dunkelblau-80 bg-hellblau-100 text-sm leading-5 font-normal hover:bg-mittelblau-70 focus-visible:outline-default h-8"
			type="button"
			onClick={handleRemoveFromChat}
		>
			{Content["documentsList.RemoveFromChat"]}
		</button>
	);
};
