import React from "react";
import Content from "../../../content";
import { useChatsStore } from "../../../store/use-chats-store";
import { DefaultDialog } from "../../primitives/dialogs/default-dialog";
import { ChatSearchLastResultButton } from "./chat-search-last-result-button";

export const chatSearchDialogId = "chat-search-dialog";

export function openChatSearchDialog() {
	return () =>
		(
			document.getElementById(chatSearchDialogId) as HTMLDialogElement
		).showModal();
}

export function closeChatSearchDialog() {
	return () =>
		(document.getElementById(chatSearchDialogId) as HTMLDialogElement).close();
}

export const ChatSearchDialog: React.FC = ({}) => {
	const { chats } = useChatsStore();
	const lastSevenChats = chats.slice(0, 7);

	return (
		<DefaultDialog id={`${chatSearchDialogId}`}>
			<div className="bg-white rounded-sm w-full md:w-[720px] max-h-[448px] max-w-[90vw] flex flex-col gap-[15px]">
				<div className="sticky top-0 bg-white flex flex-row items-center justify-between p-[18px] pl-3 gap-1">
					<img
						src="/icons/chat-search-dark-icon.svg"
						alt={Content["chatSearchButton.icon.alt"]}
						width={24}
						height={24}
						className="m-1"
					/>
					<input
						type="text"
						placeholder={Content["chatSearchDialog.placeholder"]}
						className="w-full placeholder:text-dunkelblau-80 pl-1"
					/>
					<button
						className="size-7 p-1 rounded-3px focus-visible:outline-default hover:bg-hellblau-50 flex items-center justify-center"
						onClick={closeChatSearchDialog()}
						data-testid={`close-chat-search-dialog-button`}
					>
						<img
							src="/icons/close-dialog-icon.svg"
							alt={Content["closeIcon.imgAlt"]}
						/>
					</button>
				</div>
				<div className="flex flex-col px-3 overflow-y-auto gap-2 pb-3">
					<p className="text-dunkelblau-70 text-xs leading-4 pl-3">
						{Content["chatSearchDialog.lastChats"]}
					</p>
					<ul className="flex flex-col">
						{lastSevenChats.map((chat) => (
							<li key={chat.id}>
								<ChatSearchLastResultButton chat={chat} />
							</li>
						))}
					</ul>
				</div>
			</div>
		</DefaultDialog>
	);
};
