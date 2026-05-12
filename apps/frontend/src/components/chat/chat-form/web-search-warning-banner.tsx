import React from "react";
import Content from "../../../content.ts";
import { useChatsStore } from "../../../store/use-chats-store.ts";

export const WebSearchWarningBanner: React.FC = () => {
	const { selectedChatOptions } = useChatsStore();
	const isWebSearchActive = selectedChatOptions.includes("webSearch");

	if (!isWebSearchActive) {
		return null;
	}

	return (
		<div
			className={`
            flex flex-col items-start justify-center gap-y-3 w-full px-4 py-1.5
            bg-dunkelblau-100 rounded-t-2px text-sm leading-5 text-white font-normal
            focus-visible:outline-2px`}
		>
			{Content["chat.webSearchWarningBanner.label"]}
		</div>
	);
};
