import React from "react";
import Content from "../../../content.ts";
import { useChatsStore } from "../../../store/use-chats-store.ts";
import { EXTERNAL_TOOL_PRIVACY_CONFIG } from "../../../common.ts";

export const ExternalToolWarningBanner: React.FC = () => {
	const { selectedChatOptions } = useChatsStore();
	const activeTool = selectedChatOptions.find(
		(option) => EXTERNAL_TOOL_PRIVACY_CONFIG[option],
	);

	const activeToolConfig = activeTool
		? EXTERNAL_TOOL_PRIVACY_CONFIG[activeTool]
		: null;
	if (!activeToolConfig) {
		return null;
	}

	const text = Content[activeToolConfig.warningBannerKey as keyof typeof Content];

	return (
		<div
			className={`
            flex flex-col items-start justify-center gap-y-3 w-full px-4 py-1.5
            bg-dunkelblau-100 rounded-t-2px text-sm leading-5 text-white font-normal
            focus-visible:outline-2px`}
		>
			{text}
		</div>
	);
};
