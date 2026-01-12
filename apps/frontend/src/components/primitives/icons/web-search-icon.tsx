import Content from "../../../content.ts";

export function WebSearchIcon() {
	return (
		<img
			src={`/icons/websearch-icon.svg`}
			height={14}
			width={12}
			alt={Content["chat.contextPill.webSearch.label"]}
			className="h-[14px] w-[12px] shrink-0 relative"
		/>
	);
}
