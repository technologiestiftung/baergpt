import type { JSX } from "react";
import type { ChatOption } from "../../../common";
import Content from "../../../content";
import { BaseKnowledgeIcon } from "../icons/base-knowledge-icon.tsx";
import { WebSearchIcon } from "../icons/web-search-icon.tsx";

interface ContextPillProps {
	option: ChatOption;
	onClose: () => void;
}

const icons: Record<ChatOption, JSX.Element> = {
	baseKnowledge: <BaseKnowledgeIcon />,
	webSearch: <WebSearchIcon />,
};

export function ContextPill({ option, onClose }: ContextPillProps) {
	const label = Content[`chat.contextPill.${option}.label`];

	return (
		<button
			type="button"
			onClick={onClose}
			className={`flex items-center gap-x-1 rounded-full px-2 py-1 focus-visible:outline-default bg-hellblau-30 hover:bg-hellblau-55 text-aktiv-blau-100`}
			data-option={option}
			aria-label={`${Content[`chat.contextPill.${option}.ariaLabel`]}`}
		>
			{icons[option]}
			<p className="text-sm leading-5 font-normal whitespace-nowrap shrink-0 relative">
				{label}
			</p>
			<img src="/icons/blue-close-icon.svg" alt="" className="h-4 w-4" />
		</button>
	);
}
