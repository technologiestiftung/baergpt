import React, { useEffect, useMemo, useState } from "react";
import Content from "../../content.ts";
import { useAuthStore } from "../../store/auth-store.ts";
import { useUserStore } from "../../store/user-store.ts";
import {
	ChatForm,
	focusChatForm,
	setChatInputContent,
} from "./chat-form/chat-form.tsx";
import { CONNECTOR_VALUES } from "./chat-form/chat-menu/chat-menu-connectors-submenu.tsx";
import { useChatsStore } from "../../store/use-chats-store.ts";
import { config } from "../../config.ts";
import { useCurrentChatIdStore } from "../../store/current-chat-id-store.ts";
import { useIsMobile } from "../../hooks/use-mobile.tsx";
import { GetStartedButton } from "./get-started-button.tsx";

const PARLA_MCP = CONNECTOR_VALUES.parla;

const GREETING_KEYS: {
	formal: keyof typeof Content;
	informal: keyof typeof Content;
}[] = [
	{ formal: "chat.getStarted.h1.1", informal: "chat.getStarted.h1.1" },
	{ formal: "chat.getStarted.h1.2", informal: "chat.getStarted.h1.2" },
	{
		formal: "chat.getStarted.h1.3.formal",
		informal: "chat.getStarted.h1.3.informal",
	},
	{
		formal: "chat.getStarted.h1.4.formal",
		informal: "chat.getStarted.h1.4.informal",
	},
];

export const GetStarted: React.FC = () => {
	const { session } = useAuthStore();
	const { user } = useUserStore();
	const { toggleChatTool, selectedChatTools } = useChatsStore();
	const [isShowingWritingPrompts, setIsShowingWritingPrompts] = useState(false);
	const [isChatFormCompact, setIsChatFormCompact] = useState(true);
	const [hasChatInputDraft, setHasChatInputDraft] = useState(false);
	const isParlaAllowed = config.featureFlagMcpParlaAllowed;
	const isWebSearchAllowed = config.featureFlagWebSearchAllowed;

	const { newChatCount } = useCurrentChatIdStore();
	const isMobile = useIsMobile();

	useEffect(() => {
		setIsShowingWritingPrompts(false);
	}, [newChatCount]);

	useEffect(() => {
		if (selectedChatTools.length > 0) {
			setIsChatFormCompact(false);
		} else if (!hasChatInputDraft) {
			setIsChatFormCompact(true);
		}
	}, [selectedChatTools, hasChatInputDraft]);

	useEffect(() => {
		if (!hasChatInputDraft) {
			setIsShowingWritingPrompts(false);
		}
	}, [hasChatInputDraft]);

	const greetingIndex = useMemo(
		() => Math.floor(Math.random() * GREETING_KEYS.length),
		[],
	);

	if (!session) {
		return null;
	}

	const { first_name, last_name } = session.user.user_metadata;
	const isAddressedFormal = user?.is_addressed_formal;

	const titleText = [user?.personal_title, user?.academic_title]
		.filter(Boolean)
		.join(" ");
	const formalName = titleText
		? `${titleText} ${last_name}`
		: `${first_name} ${last_name}`;

	const { formal, informal } = GREETING_KEYS[greetingIndex];
	const greeting = isAddressedFormal
		? `${Content[formal]} ${formalName}`
		: `${Content[informal]} ${first_name}`;

	const promptStarters = [
		{
			icon: "icons/parla-icon.svg",
			label: Content["chat.getStarted.parla.heading"],
			onClick: () => {
				if (isParlaAllowed) {
					toggleChatTool(PARLA_MCP);
				}
				focusChatForm();
			},
		},
		{
			icon: "icons/web-search-icon.svg",
			label: Content["chat.getStarted.webSearch.heading"],
			onClick: () => {
				if (isWebSearchAllowed) {
					toggleChatTool("webSearch");
				}
				focusChatForm();
			},
		},
		{
			icon: "icons/edit-dark-blue-icon.svg",
			label: Content["chat.getStarted.writingPrompts.heading"],
			onClick: () => {
				setIsShowingWritingPrompts(true);
			},
		},
	];

	const writingPrompts = [
		{
			icon: "icons/edit-dark-blue-icon.svg",
			label: Content["chat.getStarted.writingPrompts.prompt1"],
			input: Content["chat.getStarted.writingPrompts.prompt1.input"],
		},
		{
			icon: "icons/edit-dark-blue-icon.svg",
			label: Content["chat.getStarted.writingPrompts.prompt2"],
			input: Content["chat.getStarted.writingPrompts.prompt2.input"],
		},
		{
			icon: "icons/edit-dark-blue-icon.svg",
			label: Content["chat.getStarted.writingPrompts.prompt3"],
			input: Content["chat.getStarted.writingPrompts.prompt3.input"],
		},
	];

	return (
		<div className="flex flex-col gap-3.5 md:gap-5 flex-1 md:flex-none">
			<div className="flex flex-1 items-center justify-center md:flex-none md:mb-2">
				<h1 className="text-2xl leading-8 font-semibold md:text-4xl md:leading-10 text-dunkelblau-100 text-center">
					{greeting}
					{Content["chat.getStarted.questionMark"]}
				</h1>
			</div>

			<div className="w-full max-w-[760px] self-center flex flex-col order-2 md:order-1">
				<ChatForm
					isCompact={!isMobile && isChatFormCompact}
					onContentChange={(content) =>
						setHasChatInputDraft(content.trim().length > 0)
					}
				/>
			</div>
			<div
				className={`grid gap-1.5 self-start items-start w-full order-1 md:order-2 ${hasChatInputDraft && "invisible"}`}
			>
				{isShowingWritingPrompts ? (
					<>
						{writingPrompts.map((prompt) => (
							<GetStartedButton
								key={prompt.label}
								iconSrc={prompt.icon}
								label={prompt.label}
								onClick={() => {
									setChatInputContent(prompt.input);
								}}
							/>
						))}
					</>
				) : (
					<>
						{promptStarters.map((prompt) => (
							<GetStartedButton
								key={prompt.label}
								iconSrc={prompt.icon}
								label={prompt.label}
								onClick={prompt.onClick}
							/>
						))}
					</>
				)}
			</div>
		</div>
	);
};
