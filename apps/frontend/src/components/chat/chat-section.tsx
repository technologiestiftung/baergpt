import React from "react";
import { useChatsStore } from "../../store/use-chats-store.ts";
import { ChatForm } from "./chat-form/chat-form.tsx";
import { ChatMessages } from "./chat-messages";
import { GetStarted } from "./get-started";
import { useCurrentChatIdStore } from "../../store/current-chat-id-store.ts";
import { Content } from "../../content.ts";
import { DropZoneWrapperChat } from "./drop-zone-wrapper-chat.tsx";

export const ChatSection: React.FC = () => {
	const { chats } = useChatsStore();
	const { currentChatId } = useCurrentChatIdStore();

	console.log(currentChatId);

	const currentChat = chats.find((chat) => chat.id === currentChatId);
	console.log(currentChat);

	const currentMessages = currentChat?.messages || [];

	console.log(currentMessages);

	return (
		<DropZoneWrapperChat className="text-dunkelblau-100 w-full max-w-full mx-auto flex h-[95%] md:h-full flex-col items-center justify-between py-5 md:pt-6 relative px-4 md:px-5">
			{currentMessages.length === 0 && (
				<div className="flex flex-col w-full max-w-[640px] mb-5 overflow-y-auto">
					<GetStarted />
				</div>
			)}
			<div
				className={`w-full flex flex-col ${
					currentMessages.length === 0
						? "justify-end"
						: "h-full justify-between"
				} items-center`}
			>
				{currentMessages.length > 0 && <ChatMessages />}
				<div className="w-full flex flex-col justify-center items-center self-end">
					<div className="w-full max-w-[640px] flex flex-col">
						<ChatForm />
					</div>
					<p className="text-center text-sm leading-5 font-normal text-dunkelblau-80 mt-2 w-full max-w-[640px]">
						<span>{Content["chat.disclaimer.p1"]}</span>{" "}
						<a
							href={Content["chat.disclaimer.p2.link"]}
							target="_blank"
							rel="noopener noreferrer"
							className="underline hover:text-dunkelblau-200"
						>
							{Content["chat.disclaimer.p2"]}
						</a>
						<span> {Content["chat.disclaimer.p3"]}</span>
					</p>
				</div>
			</div>
		</DropZoneWrapperChat>
	);
};
