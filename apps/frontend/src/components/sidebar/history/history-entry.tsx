import React, { useState } from "react";
import { useCurrentChatIdStore } from "../../../store/current-chat-id-store.ts";
import type { Chat } from "../../../common.ts";
import { DeleteHistoryEntryButton } from "./delete-history-entry/delete-history-entry-button.tsx";
import { useDrawerStore } from "../../../store/drawer-store.ts";

const removeMarkdownStyling = (name: string): string => {
	return name.replace(/[#`>*]/g, "");
};

interface HistoryEntryProps {
	chat: Chat;
}

export const HistoryEntry: React.FC<HistoryEntryProps> = ({ chat }) => {
	const { currentChatId, setCurrentChatId } = useCurrentChatIdStore();
	const [isHovered, setIsHovered] = useState(false);
	const [isDeleteButtonFocused, setIsDeleteButtonFocused] = useState(false);
	const { setOpenDrawer } = useDrawerStore();

	const isSelected = currentChatId === chat.id;

	return (
		<div
			className={`relative flex flex-row items-center justify-between w-full h-8 text-sm leading-5 font-normal px-2 rounded-[3px] md:hover:bg-dunkelblau-90 ${
				isSelected && "bg-dunkelblau-90"
			}`}
			tabIndex={-1}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
		>
			<button
				className="md:max-w-[200px] md:w-[200px] w-full mr-3 md:mr-0 truncate rounded-[3px] text-start text-hellblau-50 focus:outline-default focus-visible:outline-default"
				onClick={() => {
					if (typeof window !== "undefined" && window.innerWidth < 1024) {
						setOpenDrawer(null); // Only close the drawer on mobile
					}
					setCurrentChatId(chat.id);
				}}
				onFocus={() => setIsHovered(true)}
				onBlur={() => setIsHovered(false)}
			>
				{removeMarkdownStyling(chat.name)}
			</button>

			<DeleteHistoryEntryButton
				chat={chat}
				isVisible={isHovered || isDeleteButtonFocused}
				onFocus={() => setIsDeleteButtonFocused(true)}
				onBlur={() => setIsDeleteButtonFocused(false)}
			/>
		</div>
	);
};
