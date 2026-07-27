import React from "react";
import Content from "../../../content";
import type { Chat } from "../../../common";
import {
	formatChatSearchDate,
	openChatFromSearch,
	removeMarkdownStyling,
} from "./chat-search-utils";

export const ChatSearchLastResultButton: React.FC<{ chat: Chat }> = ({
	chat,
}) => {
	return (
		<button
			type="button"
			className="w-full flex items-center justify-between gap-3 p-3 rounded-sm text-sm leading-5 hover:bg-hellblau-30 focus-visible:outline-default"
			onClick={() => {
				void openChatFromSearch(chat);
			}}
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
