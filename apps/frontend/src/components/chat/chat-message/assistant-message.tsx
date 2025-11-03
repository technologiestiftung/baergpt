import type { ReactNode } from "react";
import { BaerIcon } from "../../primitives/icons/baer-icon.tsx";
import { useInferenceLoadingStatusStore } from "../../../store/use-inference-loading-status-store.ts";
import { CopyToClipboardButton } from "./copy-to-clipboard-button.tsx";
import { ExportChatMessageButton } from "./export-chat-message/export-chat-message-button.tsx";
import { CitationsButton } from "./citations-button.tsx";
import type { ChatMessage } from "../../../common.ts";
import { useChatsStore } from "../../../store/use-chats-store.ts";
import { Content } from "../../../content.ts";
import { useErrorStore } from "../../../store/error-store.ts";

export function AssistantMessage({
	message,
	children,
}: {
	message: ChatMessage;
	children: string | ReactNode;
}) {
	const { status } = useInferenceLoadingStatusStore();
	const { getCurrentChat } = useChatsStore();
	const { content, citations } = message;
	const { getUIError } = useErrorStore();

	const exportErrorMessage = getUIError("chat-export");

	const isLastMessage = message.id === getCurrentChat()?.messages.at(-1)?.id;
	const isIdleOrLoadingCitations = ["idle", "loading-citations"].includes(
		status,
	);
	const hasChatButtons = !isLastMessage || isIdleOrLoadingCitations;

	const isBaerIconVisible = content && content.length > 0;

	return (
		<>
			<div className="flex gap-x-4 self-start">
				<div className="pt-3.5 min-w-5 min-h-5">
					{isBaerIconVisible && <BaerIcon />}
				</div>

				<div className="min-w-0 grow">{children}</div>
			</div>
			{hasChatButtons && (
				<div className="flex flex-col gap-1 ml-[30px] w-fit">
					<div className="flex items-start">
						<CopyToClipboardButton generatedAnswer={content} />
						<ExportChatMessageButton
							generatedAnswer={content}
							messageId={message.id}
						/>
						<CitationsButton
							messageId={message.id}
							citations={citations}
							isLastMessage={isLastMessage}
						/>
					</div>
					{exportErrorMessage && (
						<p className="flex rounded-3px items-center gap-1 p-[5px] bg-red-100">
							<img
								src="/icons/error-icon.svg"
								width={16}
								height={16}
								alt={Content["downloadIcon.imgAlt"]}
							/>
							<span className="text-sm leading-5 font-normal text-warning-100">
								{exportErrorMessage}
							</span>
						</p>
					)}
				</div>
			)}
		</>
	);
}
