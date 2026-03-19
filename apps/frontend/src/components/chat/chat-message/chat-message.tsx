import { AssistantMessage } from "./assistant-message.tsx";
import ReactMarkdown from "react-markdown";
import { UserMessage } from "./user-message.tsx";
import type { ChatMessage } from "../../../common.ts";
import remarkGfm from "remark-gfm";
import { markdownWrapperScrollableTable } from "../../primitives/markdown/markdown-wrapper-scrollable-table.tsx";
import type { JSX } from "react";
import { ReactMarkdownWithInlineCitations } from "./react-markdown-with-inline-citations.tsx";

interface ChatMessageProps {
	message: ChatMessage;
}

export function ChatMessage({ message }: ChatMessageProps): JSX.Element {
	const { role, content, citations } = message;

	return (
		<div className="flex flex-col">
			{role === "assistant" && content !== "" && (
				<div className="mb-8">
					<AssistantMessage message={message}>
						<ReactMarkdownWithInlineCitations
							content={content}
							citations={citations}
							className="markdown-container"
						/>
					</AssistantMessage>
				</div>
			)}

			{role === "user" && (
				<UserMessage message={message}>
					<ReactMarkdown
						remarkPlugins={[remarkGfm]}
						className="markdown-container markdown-container-user"
						components={markdownWrapperScrollableTable}
					>
						{content}
					</ReactMarkdown>
				</UserMessage>
			)}
		</div>
	);
}
