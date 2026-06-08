import removeMarkdown from "remove-markdown";
import type { ParlaCitationSource } from "../../../../common.ts";
import { TruncatedSnippet } from "./truncated-snippet.tsx";
import { ParlaIcon } from "../../../primitives/icons/parla-icon.tsx";
import Content from "../../../../content.ts";

export function ParlaCitationItem({ source }: { source: ParlaCitationSource }) {
	const href = `${source.url}#page=${source.page}`;

	return (
		<a
			href={href}
			target="_blank"
			rel="noopener noreferrer"
			className="group flex flex-col p-3.5 hover:bg-hellblau-30 text-dunkelblau-200 cursor-pointer gap-1"
		>
			<div className="flex flex-row md:items-center justify-between gap-2 items-start">
				<div className="inline-flex md:items-center gap-1 md:gap-2 min-w-0 flex-1">
					<div className="font-bold group-hover:underline text-sm truncate">
						{source.title}
					</div>
				</div>
			</div>
			<div className="flex flex-row items-center gap-2">
				<ParlaIcon />
				<div className="text-xs text-dunkelblau-40">{source.source_type}</div>
				<div className="text-xs text-dunkelblau-40">
					{Content["chat.citationsDialog.page"]} {source.page}
				</div>
			</div>
			<div className="relative flex text-sm leading-5 group-hover:underline text-dunkelblau-200 h-10">
				<TruncatedSnippet text={removeMarkdown(source.content)} lines={2} />
			</div>
		</a>
	);
}
