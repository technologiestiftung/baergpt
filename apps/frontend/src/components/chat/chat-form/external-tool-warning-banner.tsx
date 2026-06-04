import React from "react";
import Content from "../../../content.ts";
import { useChatsStore } from "../../../store/use-chats-store.ts";
import type { ChatOption } from "../../../common.ts";

const warningBannerKeys: Partial<Record<ChatOption, keyof typeof Content>> = {
	webSearch: "chat.webSearchWarningBanner.label",
	parla: "chat.parlaWarningBanner.label",
};

export const ExternalToolWarningBanner: React.FC = () => {
	const { selectedChatOptions } = useChatsStore();

	const activeKey = selectedChatOptions
		.map((option) => warningBannerKeys[option])
		.find(Boolean);

	if (!activeKey) {
		return null;
	}

	return (
		<div
			className={`
            flex flex-col items-start justify-center gap-y-3 w-full px-4 py-1.5
            bg-dunkelblau-100 rounded-t-2px text-sm leading-5 text-white font-normal
            focus-visible:outline-2px`}
		>
			{Content[activeKey]}
		</div>
	);
};
