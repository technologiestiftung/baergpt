import Content from "../../../content.ts";

export function BaseKnowledgeIcon() {
	return (
		<img
			src={`/icons/base-knowledge-icon.svg`}
			height={14}
			width={12}
			alt={Content["chat.contextPill.baseKnowledge.label"]}
			className="h-[14px] w-[12px] shrink-0 relative"
		/>
	);
}
