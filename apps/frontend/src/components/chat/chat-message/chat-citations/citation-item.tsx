import { downloadDocument } from "../../../../api/documents/download-document.ts";
import { PublicDocumentPill } from "./public-document-pill.tsx";
import { ParlaDocumentPill } from "./parla-document-pill.tsx";
import { TruncatedSnippet } from "./truncated-snippet.tsx";
import removeMarkdown from "remove-markdown";
import Content from "../../../../content.ts";
import { useCitationsStore } from "../../../../store/use-citations-store.ts";

export function CitationItem({ citationId }: { citationId: number | string }) {
	const { getCitation } = useCitationsStore();

	const citation = getCitation(citationId);

	if (!citation) {
		return null;
	}

	const handleClick = async () => {
		// For Parla documents, open the source URL directly
		if (citation.sourceType === "parla_document") {
			window.open(`${citation.sourceUrl}#page=${citation.page}`, "_blank");
			return;
		}

		const blob = await downloadDocument(citation);

		if (!blob) {
			return;
		}

		const temporaryUrl = `${URL.createObjectURL(blob)}#page=${citation.page}`;

		window.open(temporaryUrl, "_blank");

		URL.revokeObjectURL(temporaryUrl);
	};

	return (
		<button
			className="group flex flex-col p-3.5 hover:bg-hellblau-30 cursor-pointer gap-1"
			onClick={handleClick}
		>
			<div className="flex flex-row md:items-center justify-between gap-2 items-start">
				<div className="inline-flex md:items-center gap-1 md:gap-2 min-w-0 flex-1">
					<div className="font-bold group-hover:underline text-sm truncate">
						{citation.fileName}
					</div>
					<div
						className={`${citation.sourceType === "public_document" ? "hidden sm:flex" : "hidden"}`}
					>
						<PublicDocumentPill />
					</div>
					<div
						className={`${citation.sourceType === "parla_document" ? "hidden sm:flex" : "hidden"}`}
					>
						<ParlaDocumentPill />
					</div>
				</div>
			</div>
			<div className="flex flex-row items-center gap-2">
				<div className="text-xs text-dunkelblau-40">
					{Content["chat.citationsDialog.page"]} {citation.page}
				</div>
				<div
					className={`${citation.sourceType === "public_document" ? "flex sm:hidden" : "hidden"}`}
				>
					<PublicDocumentPill />
				</div>
				<div
					className={`${citation.sourceType === "parla_document" ? "flex sm:hidden" : "hidden"}`}
				>
					<ParlaDocumentPill />
				</div>
			</div>
			<div className="relative flex text-sm leading-5 group-hover:underline text-dunkelblau-200 h-10">
				<TruncatedSnippet text={removeMarkdown(citation.snippet)} lines={2} />
			</div>
		</button>
	);
}
