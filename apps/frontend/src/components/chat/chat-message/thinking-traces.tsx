import { useState, type JSX } from "react";
import type { ChatMessage, Trace, TraceTool } from "../../../common.ts";
import Content from "../../../content.ts";
import { ChevronIcon } from "../../primitives/icons/chevron-icon.tsx";
import { DocumentIcon } from "../../primitives/icons/document-icon.tsx";
import { LoadingSpinnerIcon } from "../../primitives/icons/loading-spinner-icon.tsx";
import { ParlaIcon } from "../../primitives/icons/parla-icon.tsx";
import { WebSearchIcon } from "../../primitives/icons/web-search-icon.tsx";

const toolIcons: Record<TraceTool, () => JSX.Element> = {
	webSearchTool: () => <WebSearchIcon width={20} height={20} />,
	ragSearchTool: () => <DocumentIcon variant="lightBlue" />,
	parlaMCPTools: () => <ParlaIcon />,
};

/** A tool call: icon, what was done, and a sentence describing it. */
function ToolTrace({
	tool,
	isRunning,
}: {
	tool: TraceTool;
	isRunning: boolean;
}) {
	const state = isRunning ? "running" : "done";

	return (
		<div className="flex items-start gap-x-3">
			<div className="flex size-5 shrink-0 items-center justify-center">
				{isRunning ? <LoadingSpinnerIcon size="small" /> : toolIcons[tool]()}
			</div>
			<div className={isRunning ? "text-dunkelblau-100" : undefined}>
				<p>{Content[`chat.thinking.tool.${tool}.${state}`]}</p>
				<p>{Content[`chat.thinking.tool.${tool}.${state}.description`]}</p>
			</div>
		</div>
	);
}

function TraceList({
	traces,
	runningTool,
}: {
	traces: Trace[];
	runningTool?: TraceTool;
}) {
	return (
		<div className="flex flex-col gap-y-3 text-sm leading-5 text-dunkelblau-50">
			{traces.map((trace, index) =>
				trace.type === "text" ? (
					<p key={index} className="whitespace-pre-wrap">
						{trace.text}
					</p>
				) : (
					<ToolTrace
						key={index}
						tool={trace.tool}
						// Only the last step of a trace can still be running.
						isRunning={
							trace.tool === runningTool && index === traces.length - 1
						}
					/>
				),
			)}
		</div>
	);
}

/**
 * Reasoning trace of an assistant message, rendered above the answer.
 *
 * While the model is still thinking there is no answer yet, so the trace is
 * shown in full under the loading label. Once the answer starts arriving the
 * trace collapses behind a summary line.
 */
export function ThinkingTraces({ message }: { message: ChatMessage }) {
	const { content, traces, running_tool } = message;
	const [isExpanded, setIsExpanded] = useState(false);

	if (!traces) {
		return null;
	}

	const isThinking = content === "";

	if (isThinking) {
		return (
			<div className="flex flex-col gap-y-3 text-sm leading-5 text-dunkelblau-50">
				<p>{Content["chat.loadingText"]}</p>
				<TraceList traces={traces.traces} runningTool={running_tool} />
			</div>
		);
	}

	const summary =
		traces.durationSeconds === undefined
			? Content["chat.thinking.summary"]
			: Content["chat.thinking.summaryWithDuration"].replace(
					"{seconds}",
					String(traces.durationSeconds),
				);

	return (
		<div className="mb-3.5 flex flex-col gap-y-3.5">
			<button
				type="button"
				onClick={() => setIsExpanded(!isExpanded)}
				aria-expanded={isExpanded}
				className="flex w-fit items-center gap-x-1 text-sm leading-5 text-dunkelblau-50"
			>
				{summary}
				<ChevronIcon
					color="dunkelblau-50"
					direction={isExpanded ? "up" : "down"}
				/>
			</button>
			{isExpanded && <TraceList traces={traces.traces} />}
		</div>
	);
}
