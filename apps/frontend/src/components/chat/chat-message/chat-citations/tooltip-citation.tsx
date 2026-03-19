import React from "react";
import { useTooltipCitationStore } from "../../../../store/tooltip-citation-store.ts";
import { Content } from "../../../../content";
import removeMarkdown from "remove-markdown";
import { TruncatedSnippet } from "./truncated-snippet.tsx";
import { PublicDocumentPill } from "./public-document-pill";

export const TooltipCitation: React.FC = () => {
	const {
		isCitationTooltipVisible,
		citation,
		top,
		left,
		clearHideTimeout,
		scheduleHide,
	} = useTooltipCitationStore();

	if (!isCitationTooltipVisible || !citation) {
		return null;
	}

	const { fileName, page, snippet, sourceUrl, sourceType } = citation;

	const isPublicDocument = sourceType === "public_document";

	return (
		<a
			className="absolute z-50 group rounded-3px flex flex-col gap-2.5 w-[calc(100vw-2.5rem)] sm:w-[360px] h-110 p-3 text-sm leading-5 font-normal shadow-[1px_1px_8px_rgba(12,39,83,0.25)] bg-white text-dunkelblau-200"
			style={{ top, left }}
			onMouseEnter={clearHideTimeout}
			onMouseLeave={scheduleHide}
			href={sourceUrl}
			target="_blank"
			rel="noopener noreferrer"
		>
			<div className="flex flex-row items-center justify-between gap-1.5">
				<div className="inline-flex gap-1.5 min-w-0 flex-1">
					<div className="font-bold group-hover:underline text-xs truncate min-w-0">
						{fileName}
					</div>
					<span className="text-xs text-dunkelblau-40 shrink-0">
						{Content["chat.tooltipCitation.page"]} {page}
					</span>
				</div>

				<div className={`shrink-0 ${isPublicDocument ? "flex" : "hidden"}`}>
					<PublicDocumentPill />
				</div>
			</div>
			<div className="relative flex text-sm leading-5 group-hover:underline font-normal text-dunkelblau-200">
				<TruncatedSnippet text={removeMarkdown(snippet)} lines={3} />
			</div>
		</a>
	);
};
