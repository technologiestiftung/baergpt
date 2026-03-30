import removeMarkdown from "remove-markdown";
import type { WebCitationSource } from "../../../../api/chat/get-completion.ts";
import { TruncatedSnippet } from "./truncated-snippet.tsx";

export function WebCitationItem({ source }: { source: WebCitationSource }) {
	const handleClick = () => {
		window.open(source.url, "_blank", "noopener,noreferrer");
	};

	const date = source.age?.[1] ?? "";

	const text = `${date} ${source.snippet}`;

	return (
		<button
			type="button"
			className="group flex flex-col p-3.5 hover:bg-hellblau-30 cursor-pointer gap-1"
			onClick={handleClick}
		>
			<div className="flex min-w-0 text-sm font-bold truncate group-hover:underline">
				{source.title}
			</div>
			<div className="relative flex text-sm leading-5 group-hover:underline text-dunkelblau-200 h-10">
				<TruncatedSnippet text={removeMarkdown(text)} lines={2} />
			</div>
		</button>
	);
}
