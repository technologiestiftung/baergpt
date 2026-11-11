import { AssistantMessage } from "./assistant-message.tsx";
import ReactMarkdown from "react-markdown";
import { UserMessage } from "./user-message.tsx";
import type { ChatMessage as ChatMessageType } from "../../../common.ts";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { common } from "lowlight";
import { CodeBlock } from "./code-block/code-block.tsx";
import { MarkdownWrapperScrollableTable } from "../../primitives/markdown/markdown-wrapper-scrollable-table.tsx";
import {
	MarkdownExportableTable,
	TableExportVisibleContext,
} from "../../primitives/markdown/markdown-exportable-table.tsx";
import { type ComponentProps, type JSX, memo, useMemo } from "react";
import { createMarkdownLinkWithDatawrapperEmbed } from "../../primitives/markdown/datawrapper-embed.tsx";
import { ThinkingTraces } from "./thinking-traces.tsx";
import { config } from "../../../config.ts";
import { useChatButtonsVisibility } from "../hooks/use-chat-buttons-visibility.ts";

interface ChatMessageProps {
	message: ChatMessageType;
}

const rehypePlugins: NonNullable<
	ComponentProps<typeof ReactMarkdown>["rehypePlugins"]
> = [[rehypeHighlight, { languages: common }]];

/**
 * Memoized: while an answer streams, only the streaming message gets a new
 * object (see `updateMessage`), so the markdown of all others is not re-parsed.
 */
export const ChatMessage = memo(function ChatMessage({
	message,
}: ChatMessageProps): JSX.Element {
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
			pre: CodeBlock,
		};
	}, [datawrapperChartIds]);

	const { isLastMessage, hasChatButtons } = useChatButtonsVisibility(message);
	const assistantComponents = useMemo(
		() => ({ ...customComponents, table: MarkdownExportableTable }),
		[customComponents],
	);

	return (
		<div className="flex flex-col" data-message-id={message.id}>
			{role === "assistant" && hasAssistantContent && (
				<div className="mb-8">
					<AssistantMessage
						message={message}
						isLastMessage={isLastMessage}
						hasChatButtons={hasChatButtons}
					>
						<ThinkingTraces message={message} />
						{content !== "" && (
							<TableExportVisibleContext.Provider value={hasChatButtons}>
								<ReactMarkdown
									remarkPlugins={[remarkGfm]}
									rehypePlugins={rehypePlugins}
									className="markdown-container"
									components={assistantComponents}
								>
									{content}
								</ReactMarkdown>
							</TableExportVisibleContext.Provider>
						)}
					</AssistantMessage>
				</div>
			)}

			{role === "user" && (
				<UserMessage message={message}>
					<ReactMarkdown
						remarkPlugins={[remarkGfm]}
						rehypePlugins={rehypePlugins}
						className="markdown-container markdown-container-user"
						components={customComponents}
					>
						{content}
					</ReactMarkdown>
				</UserMessage>
			)}
		</div>
	);
});
