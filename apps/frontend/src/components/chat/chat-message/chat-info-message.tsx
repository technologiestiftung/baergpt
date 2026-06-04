import React from "react";
import Content from "../../../content.ts";
import { useChatsStore } from "../../../store/use-chats-store.ts";
import type { ChatOption } from "../../../common.ts";

const infoMessageKeys: Record<
	ChatOption,
	{ title: keyof typeof Content; p1: keyof typeof Content }
> = {
	webSearch: {
		title: "chat.webSearchInfoText.title",
		p1: "chat.webSearchInfoText.p1",
	},
	parla: {
		title: "chat.parlaInfoText.title",
		p1: "chat.parlaInfoText.p1",
	},
};

export const ChatInfoMessage: React.FC = () => {
	const { autoDeactivatedExternalTool } = useChatsStore();

	if (!autoDeactivatedExternalTool) {
		return null;
	}

	const keys = infoMessageKeys[autoDeactivatedExternalTool];

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
				<h3 className="text-sm leading-5 font-semibold">
					{Content[keys.title]}
				</h3>
			</span>
			<p className="text-sm leading-5 font-normal">{Content[keys.p1]}</p>
		</div>
	);
};
