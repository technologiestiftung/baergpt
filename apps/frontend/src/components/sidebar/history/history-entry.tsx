import React, { useRef, useState } from "react";
import { useCurrentChatIdStore } from "../../../store/current-chat-id-store.ts";
import type { Chat } from "../../../common.ts";
import { HistoryEntryDropdownButton } from "./history-entry-dropdown/history-entry-dropdown-button.tsx";
import { useDrawerStore } from "../../../store/drawer-store.ts";
import { useChatsStore } from "../../../store/use-chats-store.ts";
import Content from "../../../content.ts";
import { captureError } from "../../../monitoring/capture-error.ts";

const removeMarkdownStyling = (name: string): string => {
	return name.replace(/[#`>*]/g, "");
};

interface HistoryEntryProps {
	chat: Chat;
}

export const HistoryEntry: React.FC<HistoryEntryProps> = ({ chat }) => {
	const { currentChatId, setCurrentChatId } = useCurrentChatIdStore();
	const { renameChat } = useChatsStore();
	const [isEditing, setIsEditing] = useState(false);
	const [pendingName, setPendingName] = useState<string | null>(null);
	const [isRenamePending, setIsRenamePending] = useState(false);
	const { setOpenDrawer } = useDrawerStore();
	const inputRef = useRef<HTMLInputElement>(null);

	const isSelected = currentChatId === chat.id;
	const displayedName = pendingName ?? chat.name;

	const commitRename = () => {
		const trimmedName = (inputRef.current?.value ?? "").trim();
		setIsEditing(false);

		if (trimmedName === "" || trimmedName === chat.name) {
			return;
		}

		setPendingName(trimmedName);
		setIsRenamePending(true);
		renameChat(chat.id, trimmedName)
			.then(() => setPendingName(null))
			.catch((error) => {
				captureError(error);
				setPendingName(null);
			})
			.finally(() => setIsRenamePending(false));
	};

	const cancelRename = () => {
		setIsEditing(false);
	};

	return (
		<div
			className={`group relative flex flex-row items-center justify-between
				w-full h-8 text-sm leading-5 font-normal pl-2 pr-1 md:px-2 rounded-[3px]
				md:hover:bg-dunkelblau-90 ${isSelected && "bg-dunkelblau-90"}`}
			tabIndex={-1}
		>
			{isEditing ? (
				<input
					ref={inputRef}
					type="text"
					defaultValue={chat.name}
					aria-label={Content["historyEntryDropdown.renameInput.ariaLabel"]}
					autoFocus
					onFocus={(event) => event.currentTarget.select()}
					className="md:w-full h-full w-full mr-3 md:mr-0 rounded-[3px] bg-transparent text-hellblau-50 focus-visible:outline-default"
					onKeyDown={(event) => {
						if (event.key === "Enter") {
							event.preventDefault();
							commitRename();
						}
						if (event.key === "Escape") {
							event.preventDefault();
							cancelRename();
						}
					}}
					onBlur={commitRename}
				/>
			) : (
				<button
					className="md:w-full h-full w-full mr-3 md:mr-0 truncate rounded-[3px] text-start text-hellblau-50 focus-visible:outline-default"
					onClick={() => {
						if (typeof window !== "undefined" && window.innerWidth < 1024) {
							setOpenDrawer(null); // Only close the drawer on mobile
						}
						setCurrentChatId(chat.id);
					}}
				>
					{removeMarkdownStyling(displayedName)}
				</button>
			)}

			<HistoryEntryDropdownButton
				chat={chat}
				onRename={() => {
					if (isRenamePending) {
						return;
					}
					setIsEditing(true);
				}}
			/>
		</div>
	);
};
