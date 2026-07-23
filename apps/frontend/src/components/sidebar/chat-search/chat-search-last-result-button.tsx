import React from "react";
import { useCurrentChatIdStore } from "../../../store/current-chat-id-store";
import { closeChatSearchDialog } from "./chat-search-dialog";
import { isToday } from "date-fns";
import { format } from "date-fns";
import Content from "../../../content";
import { de } from "date-fns/locale";
import type { Chat } from "../../../common";

export const ChatSearchLastResultButton: React.FC<{ chat: Chat }> = ({
	chat,
}) => {
	const { setCurrentChatId } = useCurrentChatIdStore();

	function formatChatDate(createdAt: string) {
		const date = new Date(createdAt);
		if (isToday(date)) {
			return Content["chatHistory.today"];
		}
		return format(date, "dd.MM.yyyy", { locale: de });
	}

	const removeMarkdownStyling = (name: string): string => {
		return name.replace(/[#`>*]/g, "");
	};

	return (
		<button
			type="button"
			className="w-full flex items-center justify-between p-3 rounded-sm text-sm leading-5 hover:bg-hellblau-30 focus-visible:outline-default"
			onClick={() => {
				setCurrentChatId(chat.id);
				closeChatSearchDialog()();
			}}
		>
			<div className="flex items-center gap-3">
				<img
					src="/icons/chat-bubble-light-icon.svg"
					alt={Content["chatSearchDialog.result.icon.alt"]}
					width={17}
					height={17}
				/>
				<span className="truncate text-left text-sm leading-5 font-semibold text-dunkelblau-100">
					{removeMarkdownStyling(chat.name)}
				</span>
			</div>
			<span className="shrink-0 text-dunkelblau-70 text-xs">
				{formatChatDate(chat.created_at)}
			</span>
		</button>
	);
};
