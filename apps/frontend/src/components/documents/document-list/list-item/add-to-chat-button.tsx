import React from "react";
import { AddToChatIcon } from "../../../primitives/icons/add-to-chat-icon.tsx";
import { useMobileMenuStore } from "../../../../store/use-mobile-menu.ts";

interface AddToChatButtonProps {
	isSelectedForChat: boolean;
	handleAddToChat: () => void;
}

export const AddToChatButton: React.FC<AddToChatButtonProps> = ({
	isSelectedForChat,
	handleAddToChat,
}) => {
	const { isMobileCheckboxVisible } = useMobileMenuStore();
	return (
		<button
			type="button"
			aria-label={
				isSelectedForChat ? "Aus dem Chat entfernen" : "Zum Chat hinzufügen"
			}
			className={`rounded-3px w-fit focus-visible:outline-default block ${isMobileCheckboxVisible ? "hidden" : "block"}`}
			onClick={handleAddToChat}
		>
			<AddToChatIcon variant={isSelectedForChat ? "minus" : "plus-light"} />
		</button>
	);
};
