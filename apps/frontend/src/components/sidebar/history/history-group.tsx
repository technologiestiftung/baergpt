import React from "react";
import { HistoryEntry } from "./history-entry";
import { Chat } from "../../../common";

interface HistoryGroupProps {
	label: string;
	chats: Chat[];
}

export const HistoryGroup: React.FC<HistoryGroupProps> = ({ label, chats }) => {
	return (
		<div className="flex flex-col gap-1.5">
			<div
				key={label}
				className="text-sm leading-5 font-bold text-hellblau-50 px-2"
			>
				{label}
			</div>
			{chats.map((chat) => (
				<HistoryEntry key={chat.id} chat={chat} />
			))}
		</div>
	);
};
