import React from "react";
import { useCurrentChatIdStore } from "../../../store/current-chat-id-store";
import { useTooltipStore } from "../../../store/tooltip-store";
import Content from "../../../content";

interface NewChatButtonProps {
	isExpanded?: boolean;
}

export const NewChatButton: React.FC<NewChatButtonProps> = ({
	isExpanded = false,
}) => {
	const { setCurrentChatId } = useCurrentChatIdStore();
	const { showTooltip, hideTooltip } = useTooltipStore();

	const handleInteractionStart = (
		event: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>,
	) => {
		if (isExpanded) {
			return;
		}
		showTooltip({
			event,
			content: Content["sidebar.tooltip.newChatButton"],
			isLight: true,
		});
	};

	return (
		<button
			aria-label={Content["newChatButton.ariaLabel"]}
			className={`rounded-[3px] h-8 w-full flex items-center px-1 gap-1.5 text-sm leading-5 font-semibold overflow-hidden ${
				isExpanded
					? "text-hellblau-50 max-w-[230px] hover:bg-dunkelblau-90 focus-visible:outline-default"
					: "relative self-center flex-row gap-1 bg-transparent hover:bg-dunkelblau-90 focus-visible:outline-default"
			}`}
			onClick={() => {
				setCurrentChatId(null);
				hideTooltip();
			}}
			onMouseEnter={handleInteractionStart}
			onMouseLeave={hideTooltip}
			onFocus={handleInteractionStart}
			onBlur={hideTooltip}
		>
			<img
				src="icons/new-chat-icon.svg"
				alt={Content["plusIcon.imgAlt"]}
				width={24}
				height={24}
				className="shrink-0"
			/>
			<span
				className={`whitespace-nowrap transition-opacity ${isExpanded ? "opacity-100 duration-200" : "opacity-0 duration-100"}`}
				aria-hidden={!isExpanded}
			>
				{Content["newChatButton.label"]}
			</span>
		</button>
	);
};
