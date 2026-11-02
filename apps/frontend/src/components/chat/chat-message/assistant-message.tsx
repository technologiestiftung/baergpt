import type { ReactNode } from "react";
import { BaerIcon } from "../../primitives/icons/baer-icon.tsx";
import { CopyToClipboardButton } from "./copy-to-clipboard-button.tsx";
import { ExportChatMessageButton } from "./export-chat-message/export-chat-message-button.tsx";
import { CitationsButton } from "./citations-button.tsx";
import type { ChatMessage } from "../../../common.ts";
import { useErrorStore } from "../../../store/error-store.ts";
import { useChatButtonsVisibility } from "../hooks/use-chat-buttons-visibility.ts";
import { ExportErrorMessage } from "./export-chat-message/export-error-message.tsx";

export function AssistantMessage({
	message,
	children,
}: {
	message: ChatMessage;
	children: string | ReactNode;
}) {
	const { isLastMessage, hasChatButtons } = useChatButtonsVisibility(message);
	const {
		content,
		traces,
		citations,
		web_citations,
		parla_citations,
		open_data_citations,
	} = message;
	const { getUIError } = useErrorStore();

	const exportErrorMessage = getUIError("chat-export");

	const isBaerIconVisible = content.length > 0 || Boolean(traces);

	return (
		<>
			<div
				className="flex gap-x-4 self-start"
				data-testid="assistant-message-markdown-container"
			>
				<div className="pt-3.5 min-w-5 min-h-5">
					{isBaerIconVisible && <BaerIcon />}
				</div>

				<div className="min-w-0 grow text-dunkelblau-100">{children}</div>
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
							webCitations={web_citations}
							parlaCitations={parla_citations}
							openDataCitations={open_data_citations}
							isLastMessage={isLastMessage}
						/>
					</div>
					{exportErrorMessage && (
						<ExportErrorMessage message={exportErrorMessage} />
					)}
				</div>
			)}
		</>
	);
}
