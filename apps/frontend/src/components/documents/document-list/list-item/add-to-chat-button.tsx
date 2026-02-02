import React from "react";
import Content from "../../../../content.ts";
import { PrimaryButton } from "../../../primitives/buttons/primary-button.tsx";

interface AddToChatButtonProps {
	handleAddToChat: () => void;
}

export const AddToChatButton: React.FC<AddToChatButtonProps> = ({
	handleAddToChat,
}) => {
	return (
		<PrimaryButton
			type="button"
			variant="addToChatButton"
			onClick={handleAddToChat}
			ariaLabel={Content["documentsList.AddToChat"]}
		>
			{Content["documentsList.AddToChat"]}
		</PrimaryButton>
	);
};
