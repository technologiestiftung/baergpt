import Content from "../../../content.ts";

export function WebSearchIcon() {
	return (
		<img
			src={`/icons/web-search-icon.svg`}
			height={14}
			width={12}
			alt={Content["chat.contextPill.webSearch.icon.alt"]}
			className="h-[14px] w-[12px] shrink-0 relative"
		/>
	);
}
