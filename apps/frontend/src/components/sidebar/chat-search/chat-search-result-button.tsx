import React, { useEffect, useRef } from "react";
import Content from "../../../content";
import type { Chat } from "../../../common";
import {
	formatChatSearchDate,
	openChatFromSearch,
	removeMarkdownStyling,
} from "./chat-search-utils";

interface ChatSearchResultButtonProps {
	chat: Chat;
	messageId: number;
	snippet: string;
	query: string;
	optionId: string;
	isSelected: boolean;
	isKeyboardSelection: boolean;
	onSelect: () => void;
}

export const ChatSearchResultButton: React.FC<ChatSearchResultButtonProps> = ({
	chat,
	messageId,
	snippet,
	query,
	optionId,
	isSelected,
	isKeyboardSelection,
	onSelect,
}) => {
	const buttonRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		if (isSelected) {
			buttonRef.current?.scrollIntoView({ block: "nearest" });
		}
	}, [isSelected]);

	return (
		<button
			ref={buttonRef}
			type="button"
			id={optionId}
			role="option"
			aria-selected={isSelected}
			tabIndex={-1}
			className={`w-full flex items-start justify-between gap-3 p-3 rounded-sm text-sm leading-5 ${
				isSelected
					? `bg-hellblau-30${isKeyboardSelection ? " outline-default" : ""}`
					: "hover:bg-hellblau-30"
			}`}
			onClick={() => {
				void openChatFromSearch(chat, messageId, query);
			}}
			onMouseEnter={onSelect}
		>
			<div className="flex items-center gap-3 min-w-0 w-full">
				<img
					src="/icons/chat-bubble-light-icon.svg"
					alt={Content["chatSearchDialog.result.icon.alt"]}
					width={17}
					height={17}
					className="mt-0.5 shrink-0"
				/>
				<div className="flex flex-col gap-0.5 min-w-0 w-full text-left">
					<span className="truncate w-full text-sm leading-5 font-semibold text-dunkelblau-100">
						{removeMarkdownStyling(chat.name)}
					</span>
					<span className="truncate w-full text-xs leading-4 text-dunkelblau-70">
						{buildHighlightedSnippet(snippet, query)}
					</span>
				</div>
				<span className="shrink-0 text-dunkelblau-70 text-xs pt-0.5">
					{formatChatSearchDate(chat.created_at)}
				</span>
			</div>
		</button>
	);
};

function buildHighlightedSnippet(
	snippet: string,
	query: string,
): React.ReactNode {
	const cleanedSnippet = removeMarkdownStyling(snippet).replace(/\s+/g, " ");
	const trimmedQuery = removeMarkdownStyling(query).replace(/\s+/g, " ").trim();

	const matchIndex = cleanedSnippet
		.toLowerCase()
		.indexOf(trimmedQuery.toLowerCase());

	if (matchIndex === -1) {
		return cleanedSnippet;
	}
	const CONTEXT_CHARS = 40;
	const windowStart = Math.max(0, matchIndex - CONTEXT_CHARS);
	const before = cleanedSnippet.slice(windowStart, matchIndex);
	const match = cleanedSnippet.slice(
		matchIndex,
		matchIndex + trimmedQuery.length,
	);
	const after = cleanedSnippet.slice(matchIndex + trimmedQuery.length);

	return (
		<>
			{windowStart > 0 && "..."}
			{before}
			<span className="font-semibold text-dunkelblau-100">{match}</span>
			{after}
		</>
	);
}
