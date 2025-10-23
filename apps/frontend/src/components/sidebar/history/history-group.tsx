import React from "react";
import { HistoryEntry } from "./history-entry";
import type { Chat } from "../../../common";

interface HistoryGroupProps {
	label: string;
	chats: Chat[];
}

export const HistoryGroup: React.FC<HistoryGroupProps> = ({ label, chats }) => {
	return (
		<div className="flex flex-col">
			<div
				key={label}
				className="flex items-center truncate text-sm leading-5 font-bold text-hellblau-50 h-8 md:px-2"
			>
				{label}
			</div>
			{chats.map((chat) => (
				<HistoryEntry key={chat.id} chat={chat} />
			))}
		</div>
	);
};
