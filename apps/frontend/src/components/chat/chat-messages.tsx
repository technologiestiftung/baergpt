import React from "react";
import { useInferenceLoadingStatusStore } from "../../store/use-inference-loading-status-store.ts";
import { useChatsStore } from "../../store/use-chats-store.ts";
import { ChatMessage } from "./chat-message/chat-message.tsx";
import { useCurrentChatIdStore } from "../../store/current-chat-id-store.ts";
import { BlueSquareIcon } from "../primitives/icons/blue-square-icon.tsx";
import Content from "../../content.ts";
import { chatFormId } from "./chat-form/chat-form.tsx";
import { ChatErrorMessage } from "./chat-message/chat-error-message.tsx";
import { ChatInfoMessage } from "./chat-message/chat-info-message.tsx";
import { ChatScrollButton } from "./chat-scroll-button.tsx";
import { useChatScrolling } from "./hooks/use-chat-scrolling.tsx";

export const ChatMessages: React.FC = () => {
	const { status } = useInferenceLoadingStatusStore();
	const { currentChatId } = useCurrentChatIdStore();
	const { chats } = useChatsStore();

	const currentChat = chats.find((chat) => chat.id === currentChatId);
	const messages = currentChat?.messages ?? [];
	const userMessageCount = messages.filter(
		(message) => message.role === "user",
	).length;

	const {
		messagesContainerRef,
		contentRef,
		spacerRef,
		isAtBottom,
		onScroll,
		scrollToBottom,
	} = useChatScrolling(currentChatId, userMessageCount);

	const isWaitingForResponse = status === "waiting-for-response";
	const hasError = status === "error";

	return (
		<div className="relative flex-1 min-h-0 w-full max-w-[640px] mb-2">
			<output
				ref={messagesContainerRef}
				onScroll={onScroll}
				className="h-full flex w-full justify-center overflow-y-auto text-dunkelblau-200"
				form={chatFormId}
				role="log"
			>
				<h2 className="sr-only">{Content["chat.messages.heading"]}</h2>
				<div className="w-full h-full flex flex-col gap-y-1 lg:gap-y-3.5">
					<div
						ref={contentRef}
						className="flex w-full flex-col gap-y-1 lg:gap-y-3.5"
					>
						{messages.map((message) => (
							<ChatMessage key={message.id} message={message} />
						))}
						{isWaitingForResponse && (
							<div className="text-dunkelblau-50 flex gap-2 w-full items-center">
								<BlueSquareIcon />
								<span className="text-sm">{Content["chat.loadingText"]}</span>
							</div>
						)}
						{hasError && <ChatErrorMessage />}
						<ChatInfoMessage />
					</div>
					<div ref={spacerRef} aria-hidden="true" className="shrink-0" />
				</div>
			</output>
			{!isAtBottom && <ChatScrollButton scrollToBottom={scrollToBottom} />}
		</div>
	);
};
