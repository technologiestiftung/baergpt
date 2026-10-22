import { AssistantMessage } from "./assistant-message.tsx";
import ReactMarkdown from "react-markdown";
import { UserMessage } from "./user-message.tsx";
import type { ChatMessage } from "../../../common.ts";
import remarkGfm from "remark-gfm";
import { MarkdownWrapperScrollableTable } from "../../primitives/markdown/markdown-wrapper-scrollable-table.tsx";
import { type JSX, useMemo } from "react";
import { createMarkdownLinkWithDatawrapperEmbed } from "../../primitives/markdown/datawrapper-embed.tsx";
import { ThinkingTraces } from "./thinking-traces.tsx";
import { config } from "../../../config.ts";

interface ChatMessageProps {
	message: ChatMessage;
}

export function ChatMessage({ message }: ChatMessageProps): JSX.Element {
	const { role, content, traces } = message;
	// An assistant message with traces but no content yet is still streaming
	// its reasoning, so it has to render before the answer arrives.
	const hasAssistantContent = content !== "" || Boolean(traces);

	const datawrapperChartIds = message.datawrapper_chart_ids;

	// A new link component type on every render would remount (and reload)
	// each embedded chart while streaming, so only rebuild when the ids change
	const customComponents = useMemo(() => {
		// Only ids this message's own `publish_visualization` calls produced may
		// auto-embed — never whatever the model's text happens to reproduce
		const allowedDatawrapperChartIds = config.featureFlagMcpDatawrapperAllowed
			? (datawrapperChartIds ?? [])
			: [];

		return {
			table: MarkdownWrapperScrollableTable,
			a: createMarkdownLinkWithDatawrapperEmbed(allowedDatawrapperChartIds),
			img: () => null,
		};
	}, [datawrapperChartIds]);

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
