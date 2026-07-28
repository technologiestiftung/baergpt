import React from "react";
import Content from "../../../content";
import { useChatsStore } from "../../../store/use-chats-store";
import { DefaultDialog } from "../../primitives/dialogs/default-dialog";
import { ChatSearchEmptyState } from "./chat-search-empty-state";
import { ChatSearchSkeleton } from "./chat-search-skeleton";
import { ChatSearchLastResultButton } from "./chat-search-last-result-button";
import { ChatSearchResultButton } from "./chat-search-result-button";
import {
	chatSearchDialogId,
	closeChatSearchDialog,
} from "./chat-search-dialog-controls";
import { openChatFromSearch } from "./chat-search-utils";
import { useChatSearch } from "./use-chat-search";

export {
	chatSearchDialogId,
	closeChatSearchDialog,
	openChatSearchDialog,
} from "./chat-search-dialog-controls";

const chatSearchListboxId = "chat-search-listbox";

const getChatSearchOptionId = (messageId: number): string =>
	`chat-search-option-${messageId}`;

export const ChatSearchDialog: React.FC = () => {
	const { chats } = useChatsStore();
	const lastChats = chats.slice(0, 8);
	const {
		query,
		setQuery,
		results,
		isLoading,
		selectedIndex,
		setSelectedIndex,
		moveSelection,
		reset,
		hasQuery,
	} = useChatSearch();

	const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
		if (!hasQuery || isLoading || results.length === 0) {
			return;
		}

		if (event.key === "ArrowDown") {
			event.preventDefault();
			moveSelection("down");
			return;
		}

		if (event.key === "ArrowUp") {
			event.preventDefault();
			moveSelection("up");
			return;
		}

		if (event.key === "Enter") {
			event.preventDefault();
			const selectedResult = results[selectedIndex];
			if (selectedResult) {
				void openChatFromSearch(
					selectedResult.chat,
					selectedResult.messageId,
					query,
				);
			}
		}
	};

	const renderBody = () => {
		if (!hasQuery) {
			return (
				<>
					<p className="text-dunkelblau-70 text-xs leading-4 pl-3">
						{Content["chatSearchDialog.lastChats"]}
					</p>
					<ul className="flex flex-col">
						{lastChats.map((chat) => (
							<li key={chat.id}>
								<ChatSearchLastResultButton chat={chat} />
							</li>
						))}
					</ul>
				</>
			);
		}

		if (isLoading) {
			return <ChatSearchSkeleton />;
		}

		if (results.length === 0) {
			return <ChatSearchEmptyState query={query.trim()} />;
		}

		return (
			<>
				<p
					className="text-dunkelblau-70 text-xs leading-4 pl-3"
					id={`${chatSearchListboxId}-label`}
				>
					{Content["chatSearchDialog.results"]}
				</p>
				<ul
					className="flex flex-col"
					role="listbox"
					id={chatSearchListboxId}
					aria-labelledby={`${chatSearchListboxId}-label`}
				>
					{results.map((result, index) => (
						<li key={result.messageId} role="presentation">
							<ChatSearchResultButton
								chat={result.chat}
								messageId={result.messageId}
								snippet={result.snippet}
								query={query}
								optionId={getChatSearchOptionId(result.messageId)}
								isSelected={index === selectedIndex}
								onSelect={() => setSelectedIndex(index)}
							/>
						</li>
					))}
				</ul>
			</>
		);
	};

	return (
		<DefaultDialog id={chatSearchDialogId} afterClose={reset}>
			<div className="bg-white rounded-sm w-full md:w-[720px] md:h-[460px] flex flex-col gap-[15px]">
				<div className="sticky top-0 bg-white flex flex-row items-center justify-between p-[18px] pl-3 gap-1">
					<img
						src="/icons/chat-search-dark-icon.svg"
						alt={Content["chatSearchButton.icon.alt"]}
						width={24}
						height={24}
						className="m-1"
					/>
					<input
						type="text"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						onKeyDown={handleKeyDown}
						placeholder={Content["chatSearchDialog.placeholder"]}
						className="w-full placeholder:text-dunkelblau-80 pl-1 text-dunkelblau-100 text-sm leading-5 focus:outline-none"
						aria-label={Content["chatSearchDialog.placeholder"]}
						autoComplete="off"
						autoFocus
						role="combobox"
						aria-autocomplete="list"
						aria-expanded={results.length > 0}
						aria-controls={chatSearchListboxId}
						aria-activedescendant={
							results.length > 0 && results[selectedIndex]
								? getChatSearchOptionId(results[selectedIndex].messageId)
								: undefined
						}
					/>
					<button
						type="button"
						className="size-8 p-1 rounded-3px focus-visible:outline-default hover:bg-hellblau-50 flex items-center justify-center"
						onClick={closeChatSearchDialog}
						data-testid="close-chat-search-dialog-button"
					>
						<img
							src="/icons/close-dialog-icon.svg"
							alt={Content["closeIcon.imgAlt"]}
							width={14}
							height={14}
						/>
					</button>
				</div>
				<div className="flex flex-col px-3 overflow-y-auto gap-2">
					{renderBody()}
				</div>
			</div>
		</DefaultDialog>
	);
};
