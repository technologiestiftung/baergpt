import React from "react";
import Content from "../../../content.ts";
import { useChatsStore } from "../../../store/use-chats-store.ts";

export const ChatInfoMessage: React.FC = () => {
	const { autoDeactivatedExternalTools } = useChatsStore();

	if (autoDeactivatedExternalTools.length === 0) {
		return null;
	}

	return (
		<>
			{autoDeactivatedExternalTools.map((tool) => (
				<div
					key={tool}
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
							{Content[`chat.${tool}.infoText.title`]}
						</h3>
					</span>
					<p className="text-sm leading-5 font-normal">
						{Content[`chat.${tool}.infoText.p1`]}
					</p>
				</div>
			))}
		</>
	);
};
