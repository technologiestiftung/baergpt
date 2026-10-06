import React from "react";
import Content from "../../../content.ts";
import { ArrowWhiteRightIcon } from "../../primitives/icons/arrow-white-right-icon.tsx";
import { ChatStopGeneratingIcon } from "../../primitives/icons/chat-stop-generating-icon.tsx";

interface ChatSubmitButtonProps {
	showLoading: boolean;
	handleStop: (event: React.MouseEvent<HTMLButtonElement>) => void;
	isDisabled: boolean;
}

export const ChatSubmitButton: React.FC<ChatSubmitButtonProps> = ({
	showLoading,
	handleStop,
	isDisabled,
}) => {
	return showLoading ? (
		<button
			type="button"
			aria-label={Content["chat.stopGeneratingButton.ariaLabel"]}
			onClick={handleStop}
			className="rounded-3px size-8 bg-hellblau-50 flex items-center justify-center shrink-0 hover:bg-hellblau-110 focus-visible:outline-2px"
		>
			<ChatStopGeneratingIcon />
		</button>
	) : (
		<button
			type="submit"
			disabled={isDisabled}
			aria-label={Content["chat.sendButton.ariaLabel"]}
			className={`rounded-3px size-8 bg-dunkelblau-100 disabled:bg-dunkelblau-30 p-1.5 hover:bg-dunkelblau-90 focus-visible:outline-2px shrink-0`}
		>
			<ArrowWhiteRightIcon />
		</button>
	);
};
