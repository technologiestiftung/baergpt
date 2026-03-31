import { useState } from "react";
import removeMarkdown from "remove-markdown";
import type { WebCitationSource } from "../../../../api/chat/get-completion.ts";
import { TruncatedSnippet } from "./truncated-snippet.tsx";

const GLOBE_ICON_SRC = "/icons/web-search-icon.svg";

function faviconUrlForHostname(hostname: string) {
	return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=32`;
}

export function WebCitationItem({ source }: { source: WebCitationSource }) {
	const hostname = new URL(source.url).hostname;
	const [iconSrc, setIconSrc] = useState(() => faviconUrlForHostname(hostname));

	const handleClick = () => {
		window.open(source.url, "_blank", "noopener,noreferrer");
	};

	const date = source.age?.[1] ? `${source.age?.[1]} –` : "";
	const textWithDate = `${date} ${source.snippet}`;

	return (
		<button
			type="button"
			className="group flex flex-col items-start p-3.5 hover:bg-hellblau-30 text-dunkelblau-200 cursor-pointer gap-2.5"
			onClick={handleClick}
		>
			<div className="flex items-center gap-1 text-xs">
				<img
					src={iconSrc}
					alt=""
					width={16}
					height={16}
					className="size-4 shrink-0"
					onError={() => setIconSrc(GLOBE_ICON_SRC)}
				/>
				{hostname}
			</div>
			<div className="flex min-w-0 text-sm font-bold truncate group-hover:underline">
				{source.title}
			</div>
			<div className="relative flex text-sm leading-5 group-hover:underline h-10">
				<TruncatedSnippet text={removeMarkdown(textWithDate)} lines={2} />
			</div>
		</button>
	);
}
