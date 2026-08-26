import React from "react";
import Content from "../../../content.ts";
import { useChatsStore } from "../../../store/use-chats-store.ts";
import type { ChatTool } from "../../../common.ts";

const joinToolLabels = (tools: ChatTool[]): string => {
	const labels = tools.map((tool) => Content[`chat.contextPill.${tool}.label`]);
	if (labels.length < 2) {
		return labels.join("");
	}
	return `${labels.slice(0, -1).join(", ")} und ${labels[labels.length - 1]}`;
};

export const ChatInfoMessage: React.FC = () => {
	const { visibleInfoMessage } = useChatsStore();

	if (!visibleInfoMessage) {
		return null;
	}

	if (visibleInfoMessage.type === "toolDeactivated") {
		const { tools } = visibleInfoMessage;
		const title =
			tools.length > 1
				? `${joinToolLabels(tools)} wurden automatisch deaktiviert.`
				: Content[`chat.${tools[0]}.infoText.title`];
		const body =
			tools.length > 1
				? Content["chat.toolsDeactivated.infoText.p1"]
				: Content[`chat.${tools[0]}.infoText.p1`];

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
	}
	// Chat history paused info message when external sources are active
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
					{Content["chat.chatHistoryPaused.infoText.title"]}
				</h3>
			</span>
			<p className="text-sm leading-5 font-normal">
				{Content["chat.chatHistoryPaused.infoText.p1"]}
			</p>
		</div>
	);
};
