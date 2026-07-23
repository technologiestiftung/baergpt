import type { JSX } from "react";
import type { ChatTool } from "../../../common";
import Content from "../../../content";
import { WebSearchIcon } from "../icons/web-search-icon.tsx";
import { ParlaIcon } from "../icons/parla-icon.tsx";
import { OpenDataIcon } from "../icons/open-data-icon.tsx";

interface ContextPillProps {
	tool: ChatTool;
	onClose: () => void;
}

const icons: Record<ChatTool, JSX.Element> = {
	webSearch: <WebSearchIcon variant="active" />,
	parla: <ParlaIcon />,
	openData: <OpenDataIcon />,
};

export function ContextPill({ tool, onClose }: ContextPillProps) {
	const label = Content[`chat.contextPill.${tool}.label`];

	return (
		<button
			type="button"
			onClick={onClose}
			className={`flex items-center gap-x-1 rounded-full px-2 py-1 focus-visible:outline-default bg-hellblau-30 hover:bg-hellblau-55 text-aktiv-blau-100`}
			data-option={tool}
			aria-label={`${Content[`chat.contextPill.${tool}.ariaLabel`]}`}
		>
			{icons[tool]}
			<p className="text-sm leading-5 font-normal whitespace-nowrap shrink-0 relative">
				{label}
			</p>
			<img src="/icons/blue-close-icon.svg" alt="" className="h-4 w-4" />
		</button>
	);
}
