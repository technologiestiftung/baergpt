import React, { useRef } from "react";
import { useInferenceLoadingStatusStore } from "../../store/use-inference-loading-status-store.ts";
import { useChatsStore } from "../../store/use-chats-store.ts";
import { ChatMessage } from "./chat-message/chat-message.tsx";
import { useCurrentChatIdStore } from "../../store/current-chat-id-store.ts";
import { BlueSquareIcon } from "../primitives/icons/blue-square-icon.tsx";
import { useScrollToBottom } from "./hooks/use-scroll-to-bottom.tsx";
import { useChatScrollingStore } from "../../store/use-chat-scrolling-store.ts";
import Content from "../../content.ts";

export const ChatMessages: React.FC = () => {
	const { status } = useInferenceLoadingStatusStore();
	const { currentChatId } = useCurrentChatIdStore();
	const { chats } = useChatsStore();
	const { handleScroll } = useChatScrollingStore();

	const messageContainerRef = useRef<null | HTMLDivElement>(null);

	useScrollToBottom(messageContainerRef);

	const currentChat = chats.find((chat) => chat.id === currentChatId);

	const isSafari =
		navigator.userAgent.indexOf("Safari") !== -1 &&
		navigator.userAgent.indexOf("Chrome") === -1;

	const isWaitingForResponse = status === "waiting-for-response";
	const hasError = status === "error";

	return (
		<div
			ref={messageContainerRef}
			onScroll={() => handleScroll(messageContainerRef)}
			className={`relative h-full text-dunkelblau-200 flex w-full max-w-[640px] justify-center overflow-y-auto mb-2 ${
				isSafari ? "scroll-auto" : "scroll-smooth"
			}`}
		>
			<div className="w-full h-full flex flex-col gap-y-4">
				{currentChat?.messages.map((message) => (
					<ChatMessage key={message.id} message={message} />
				))}
				{isWaitingForResponse && (
					<div className="text-dunkelblau-80 flex gap-2 w-full items-center">
						<BlueSquareIcon />
						<span>{Content["chat.loadingText"]}</span>
					</div>
				)}
				{hasError && (
					<div className="flex flex-col gap-2 w-full px-3 py-[18px] text-warning-100 rounded-[3px] bg-warning-10">
						<p>
							<span className="flex gap-1">
								<img
									src="/icons/error-icon.svg"
									alt={Content["chat.errorIcon.imgAlt"]}
									className="w-4 h-4"
								/>
								<span className="text-sm leading-5 font-semibold">
									{Content["chat.errorText.title"]}
								</span>
							</span>
							<span className="text-sm leading-5 font-normal pl-5">
								{" "}
								{Content["chat.errorText.p1"]}
							</span>
						</p>
						<span className="text-sm leading-5 font-normal pl-5">
							{Content["chat.errorText.p2"]}
							<a
								href={Content["chat.errorText.helpPage.link"]}
								className="text-sm leading-5 font-normal underline cursor-pointer text-dunkelblau-100"
								target="_blank"
								rel="noopener noreferrer"
							>
								{Content["chat.errorText.helpPage.linkText"]}
							</a>
						</span>
					</div>
				)}
			</div>
		</div>
	);
};
