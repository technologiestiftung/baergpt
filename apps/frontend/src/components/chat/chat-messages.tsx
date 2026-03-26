import React, { useRef } from "react";
import { useInferenceLoadingStatusStore } from "../../store/use-inference-loading-status-store.ts";
import { useChatsStore } from "../../store/use-chats-store.ts";
import { ChatMessage } from "./chat-message/chat-message.tsx";
import { useCurrentChatIdStore } from "../../store/current-chat-id-store.ts";
import { BlueSquareIcon } from "../primitives/icons/blue-square-icon.tsx";
import { useScrollToBottom } from "./hooks/use-scroll-to-bottom.tsx";
import { useChatScrollingStore } from "../../store/use-chat-scrolling-store.ts";
import Content from "../../content.ts";
import { chatFormId } from "./chat-form/chat-form.tsx";
import { ChatErrorMessage } from "./chat-message/chat-error-message.tsx";
import { ChatInfoMessage } from "./chat-message/chat-info-message.tsx";

export const ChatMessages: React.FC = () => {
	const { status } = useInferenceLoadingStatusStore();
	const { currentChatId } = useCurrentChatIdStore();
	const { chats } = useChatsStore();
	const { handleScroll } = useChatScrollingStore();

	const messageContainerRef = useRef<null | HTMLOutputElement>(null);

	useScrollToBottom(messageContainerRef);

	const currentChat = chats.find((chat) => chat.id === currentChatId);

	const isSafari =
		navigator.userAgent.indexOf("Safari") !== -1 &&
		navigator.userAgent.indexOf("Chrome") === -1;

	const isWaitingForResponse = status === "waiting-for-response";
	const hasError = status === "error";

	return (
		<output
			ref={messageContainerRef}
			onScroll={() => handleScroll(messageContainerRef)}
			className={`relative h-full text-dunkelblau-200 flex w-full max-w-[640px] justify-center overflow-y-auto mb-2 ${
				isSafari ? "scroll-auto" : "scroll-smooth"
			}`}
			form={chatFormId}
			role="log"
		>
			<h2 className="sr-only">{Content["chat.messages.heading"]}</h2>
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
				{hasError && <ChatErrorMessage />}
				<ChatInfoMessage />
			</div>
		</output>
	);
};
