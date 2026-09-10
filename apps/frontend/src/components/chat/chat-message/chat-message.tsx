import { AssistantMessage } from "./assistant-message.tsx";
import ReactMarkdown from "react-markdown";
import { UserMessage } from "./user-message.tsx";
import type { ChatMessage } from "../../../common.ts";
import remarkGfm from "remark-gfm";
import { MarkdownWrapperScrollableTable } from "../../primitives/markdown/markdown-wrapper-scrollable-table.tsx";
import type { JSX } from "react";
import { AnchorLinkTargetBlank } from "../../primitives/markdown/anchor-link-target-blank.tsx";
import { ThinkingTraces } from "./thinking-traces.tsx";

interface ChatMessageProps {
	message: ChatMessage;
}

const customComponents = {
	table: MarkdownWrapperScrollableTable,
	a: AnchorLinkTargetBlank,
	img: () => null,
};

export function ChatMessage({ message }: ChatMessageProps): JSX.Element {
	const { role, content, traces } = message;
	// An assistant message with traces but no content yet is still streaming
	// its reasoning, so it has to render before the answer arrives.
	const hasAssistantContent = content !== "" || Boolean(traces);

	return (
		<div className="flex flex-col" data-message-id={message.id}>
			{role === "assistant" && hasAssistantContent && (
				<div className="mb-8">
					<AssistantMessage message={message}>
						<ThinkingTraces message={message} />
						{content !== "" && (
							<ReactMarkdown
								remarkPlugins={[remarkGfm]}
								className="markdown-container"
								components={customComponents}
							>
								{content}
							</ReactMarkdown>
						)}
					</AssistantMessage>
				</div>
			)}

			{role === "user" && (
				<UserMessage message={message}>
					<ReactMarkdown
						remarkPlugins={[remarkGfm]}
						className="markdown-container markdown-container-user"
						components={customComponents}
					>
						{content}
					</ReactMarkdown>
				</UserMessage>
			)}
		</div>
	);
}
