import React from "react";
import { useTooltipStore } from "../../../store/tooltip-store";
import Content from "../../../content";
import {
	ChatSearchDialog,
	openChatSearchDialog,
} from "../chat-search/chat-search-dialog";

interface ChatSearchButtonProps {
	isExpanded?: boolean;
}

export const ChatSearchButton: React.FC<ChatSearchButtonProps> = ({
	isExpanded = false,
}) => {
	const { showTooltip, hideTooltip } = useTooltipStore();

	const handleInteractionStart = (
		event: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>,
	) => {
		if (isExpanded) {
			return;
		}
		showTooltip({
			event,
			content: Content["sidebar.tooltip.chatSearchButton"],
			isLight: true,
		});
	};

	return (
		<>
			<button
				aria-label={Content["chatSearchButton.ariaLabel"]}
				className={`rounded-[3px] w-full h-8 flex items-center px-1 gap-1.5 text-sm leading-5 font-semibold ${
					isExpanded
						? "text-hellblau-50 max-w-[230px] hover:bg-dunkelblau-90 focus-visible:outline-default"
						: "relative self-center flex-row gap-1 bg-transparent hover:bg-dunkelblau-90 focus-visible:outline-default"
				}`}
				onClick={openChatSearchDialog}
				onMouseEnter={handleInteractionStart}
				onMouseLeave={hideTooltip}
				onFocus={handleInteractionStart}
				onBlur={hideTooltip}
			>
				<img
					src="icons/chat-search-light-icon.svg"
					alt={Content["chatSearchButton.icon.alt"]}
					width={24}
					height={24}
				/>
				{isExpanded && (
					<span className="whitespace-nowrap">
						{Content["chatSearchButton.label"]}
					</span>
				)}
			</button>
			<ChatSearchDialog />
		</>
	);
};
