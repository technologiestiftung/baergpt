import React from "react";
import Content from "../../../content.ts";
import type { ChatOption } from "../../../common.ts";
import { EXTERNAL_TOOL_PRIVACY_CONFIG } from "../../../common.ts";

export const ChatInfoMessage: React.FC<{ tool: ChatOption }> = ({ tool }) => {
	const config = EXTERNAL_TOOL_PRIVACY_CONFIG[tool];
	if (!config) {
		return null;
	}

	const { displayName } = config;
	const title = Content["chat.infoText.deactivated.title"].replace(
		"{name}",
		displayName,
	);
	const body = Content["chat.infoText.deactivated.body"].replace(
		/\{name\}/g,
		displayName,
	);

	return (
		<div
			role="alert"
			className="flex flex-col gap-1 w-full px-3 py-[18px] text-dunkelblau-100 rounded-[3px] bg-hellblau-50"
		>
			<span className="flex gap-1 items-center">
				<img
					src="/icons/info-icon-blue.svg"
					alt={Content["chat.infoText.imgAlt"]}
					className="w-4 h-4"
				/>
				<h3 className="text-sm leading-5 font-semibold">{title}</h3>
			</span>
			<p className="text-sm leading-5 font-normal">{body}</p>
		</div>
	);
};
