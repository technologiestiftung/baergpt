import React, { useState } from "react";
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
import { useChatSearch } from "./use-chat-search";
import { useChatSearchKeyboard } from "./use-chat-search-keyboard";

export {
	chatSearchDialogId,
	closeChatSearchDialog,
	openChatSearchDialog,
} from "./chat-search-dialog-controls";

const chatSearchListboxId = "chat-search-listbox";

const getChatSearchOptionId = (messageId: number): string =>
	`chat-search-option-${messageId}`;

const getChatSearchLastOptionId = (chatId: number): string =>
	`chat-search-last-option-${chatId}`;

export const ChatSearchDialog: React.FC = () => {
	const { chats } = useChatsStore();
	const lastChats = chats.slice(0, 8);
	const {
		query,
		setQuery,
		results,
		isLoading,
		selectedIndex,
		selectIndex,
		isKeyboardSelection,
		moveSelection,
		reset,
		hasQuery,
	} = useChatSearch();

	const {
		inputRef,
		closeButtonRef,
		handleInputKeyDown,
		handleCloseButtonKeyDown,
	} = useChatSearchKeyboard({
		query,
		hasQuery,
		isLoading,
		results,
		lastChats,
		selectedIndex,
		moveSelection,
	});

	const isLoadingResults = hasQuery && isLoading;
	const hasResults = hasQuery && !isLoading && results.length > 0;
	const hasNoResults = hasQuery && !isLoading && results.length === 0;
	const showLastChats = !hasQuery && lastChats.length > 0;
	let activeOptionId: string | undefined;

	if (hasQuery) {
		const selectedResult = results[selectedIndex];
		activeOptionId = selectedResult
			? getChatSearchOptionId(selectedResult.messageId)
			: undefined;
	}

	if (!hasQuery) {
		const selectedLastChat = lastChats[selectedIndex];
		activeOptionId = selectedLastChat
			? getChatSearchLastOptionId(selectedLastChat.id)
			: undefined;
	}

	const [areResultsScrolled, setAreResultsScrolled] = useState(false);

	const handleResultsScroll = (event: React.UIEvent<HTMLDivElement>) => {
		setAreResultsScrolled(event.currentTarget.scrollTop > 0);
	};

	return (
		<DefaultDialog id={chatSearchDialogId} afterClose={reset}>
			<div className="bg-white rounded-sm w-full md:w-[720px] md:h-[460px] flex flex-col">
				<div
					className={`sticky top-0 bg-white flex flex-row items-center justify-between p-[18px] pl-3 gap-1 border-b-[0.5px] ${areResultsScrolled ? "border-dunkelblau-50" : "border-transparent"}`}
				>
					<img
						src="/icons/chat-search-dark-icon.svg"
						alt={Content["chatSearchButton.icon.alt"]}
						width={24}
						height={24}
						className="m-1"
					/>
					<input
						ref={inputRef}
						type="text"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						onKeyDown={handleInputKeyDown}
						placeholder={Content["chatSearchDialog.placeholder"]}
						className="w-full placeholder:text-dunkelblau-80 pl-1 text-dunkelblau-100 text-sm leading-5 focus:outline-none"
						aria-label={Content["chatSearchDialog.placeholder"]}
						autoComplete="off"
						autoFocus
						role="combobox"
						aria-autocomplete="list"
						aria-expanded={showLastChats || hasResults}
						aria-controls={chatSearchListboxId}
						aria-activedescendant={activeOptionId}
					/>
					<button
						ref={closeButtonRef}
						type="button"
						className="size-8 p-1 rounded-3px focus-visible:outline-default hover:bg-hellblau-50 flex items-center justify-center"
						onClick={closeChatSearchDialog}
						onKeyDown={handleCloseButtonKeyDown}
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
				<div
					onScroll={handleResultsScroll}
					tabIndex={-1}
					className="flex flex-col px-3 overflow-y-auto chatsearch-scrollbar gap-2 pt-[15px]"
				>
					{!hasQuery && (
						<>
							<p
								className="text-dunkelblau-70 text-xs leading-4 pl-3"
								id={`${chatSearchListboxId}-label`}
							>
								{Content["chatSearchDialog.lastChats"]}
							</p>
							<ul
								className="flex flex-col"
								role="listbox"
								id={chatSearchListboxId}
								aria-labelledby={`${chatSearchListboxId}-label`}
							>
								{lastChats.map((chat, index) => (
									<li key={chat.id} role="presentation">
										<ChatSearchLastResultButton
											chat={chat}
											optionId={getChatSearchLastOptionId(chat.id)}
											isSelected={index === selectedIndex}
											isKeyboardSelection={isKeyboardSelection}
											onSelect={() => selectIndex(index)}
										/>
									</li>
								))}
							</ul>
						</>
					)}
					{isLoadingResults && <ChatSearchSkeleton />}
					{hasNoResults && <ChatSearchEmptyState query={query.trim()} />}
					{hasResults && (
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
											isKeyboardSelection={isKeyboardSelection}
											onSelect={() => selectIndex(index)}
										/>
									</li>
								))}
							</ul>
						</>
					)}
				</div>
			</div>
		</DefaultDialog>
	);
};
