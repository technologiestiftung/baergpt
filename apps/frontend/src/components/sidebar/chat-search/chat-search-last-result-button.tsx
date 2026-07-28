import React, { useEffect, useRef } from "react";
import Content from "../../../content";
import type { Chat } from "../../../common";
import {
	formatChatSearchDate,
	openChatFromSearch,
	removeMarkdownStyling,
} from "./chat-search-utils";

interface ChatSearchLastResultButtonProps {
	chat: Chat;
	optionId: string;
	isSelected: boolean;
	onSelect: () => void;
}

export const ChatSearchLastResultButton: React.FC<
	ChatSearchLastResultButtonProps
> = ({ chat, optionId, isSelected, onSelect }) => {
	const buttonRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		if (isSelected) {
			buttonRef.current?.scrollIntoView({ block: "nearest" });
		}
	}, [isSelected]);

	return (
		<button
			ref={buttonRef}
			type="button"
			id={optionId}
			role="option"
			aria-selected={isSelected}
			tabIndex={-1}
			className={`w-full flex items-center justify-between gap-3 p-3 rounded-sm text-sm leading-5 focus-visible:outline-default ${
				isSelected ? "bg-hellblau-30" : "hover:bg-hellblau-30"
			}`}
			onClick={() => {
				void openChatFromSearch(chat);
			}}
			onMouseEnter={onSelect}
		>
			<div className="flex items-center gap-3 min-w-0">
				<img
					src="/icons/chat-bubble-light-icon.svg"
					alt={Content["chatSearchDialog.result.icon.alt"]}
					width={17}
					height={17}
					className="shrink-0"
				/>
				<span className="truncate text-left text-sm leading-5 font-semibold text-dunkelblau-100">
					{removeMarkdownStyling(chat.name)}
				</span>
			</div>
			<span className="shrink-0 text-dunkelblau-70 text-xs">
				{formatChatSearchDate(chat.created_at)}
			</span>
		</button>
	);
};
