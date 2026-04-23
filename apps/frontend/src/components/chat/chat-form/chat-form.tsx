import React, {
	type FormEvent,
	type KeyboardEvent,
	useRef,
	useState,
} from "react";
import { useChatScrollingStore } from "../../../store/use-chat-scrolling-store.ts";
import { useInferenceLoadingStatusStore } from "../../../store/use-inference-loading-status-store.ts";
import { SelectedChatItemsCollapsible } from "../selected-chat-items/selected-chat-items-collapsible.tsx";
import { ArrowWhiteRightIcon } from "../../primitives/icons/arrow-white-right-icon.tsx";
import { ChatStopGeneratingIcon } from "../../primitives/icons/chat-stop-generating-icon.tsx";
import { useChatStreamingStore } from "../../../store/use-chat-streaming-store.ts";
import { useFolderStore } from "../../../store/folder-store.ts";
import { useDocumentStore } from "../../../store/document-store.ts";
import Content from "../../../content.ts";
import type { NewChatMessage } from "../../../common.ts";
import { getCompletion } from "../../../api/chat/get-completion.ts";
import { useChatsStore } from "../../../store/use-chats-store.ts";
import { ChatOptionsToggleButton } from "./chat-options-toggle-button.tsx";
import { LlmModelToggleButton } from "./llm-model-toggle-button.tsx";
import { ContextPill } from "../../primitives/pill/context-pill.tsx";
import * as Sentry from "@sentry/react";

const { setHasUserScrolledUp } = useChatScrollingStore.getState();

export const chatFormId = "chat-form";

export const ChatForm: React.FC = () => {
	const { status, clearError } = useInferenceLoadingStatusStore();
	const { selectedChatFolders } = useFolderStore();
	const { selectedChatDocuments } = useDocumentStore();
	const { getCurrentOrCreateChat, selectedChatOptions, toggleChatOption } =
		useChatsStore();
	const { abortStreaming } = useChatStreamingStore.getState();

	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const [textareaContent, setTextareaContent] = useState("");

	// Resize textarea on input
	const handleTextAreaInput = () => {
		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
			textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
			setTextareaContent(textareaRef.current.value);
		}
	};

	// Handle Enter key to submit the form
	// and create a new line with Shift + Enter
	const handleTextAreaKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
		const isSubmit = event.key === "Enter" && !event.shiftKey;
		if (isSubmit) {
			event.preventDefault();
			event.currentTarget.form?.requestSubmit();
		}
	};

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setHasUserScrolledUp(false);

		const form = event.currentTarget;
		const textarea = textareaRef.current;

		// Check if textarea only contains whitespace
		const messageText = form.content.value.trim();
		if (!messageText) {
			return;
		}

		// Clear any previous errors
		clearError();

		// Clear textarea on submit
		if (textarea) {
			textarea.value = "";
			handleTextAreaInput(); // Reset height
		}
		const userMessage: NewChatMessage = {
			type: "text",
			role: "user",
			content: messageText,
			citations: null,
			web_citations: null,
			allowed_document_ids: selectedChatDocuments.map((doc) => doc.id),
			allowed_folder_ids: selectedChatFolders.map((folder) => folder.id),
		};

		const model = useChatsStore.getState().selectedLlmModel;

		Sentry.startSpan(
			{
				name: "Stream Chat Message Response",
				op: `chat.message.stream.${model}`,
			},
			async (span) => {
				const chat = await getCurrentOrCreateChat(userMessage);
				await getCompletion(chat, span);
			},
		);
	};

	const isInferenceLoading = [
		"waiting-for-response",
		"loading-text",
		"loading-citations",
	].includes(status);

	const hasError = status === "error";

	return (
		<form
			onSubmit={handleSubmit}
			className="flex flex-col max-h-[290px] focus-visible:outline-2px hover:outline hover:outline-2 hover:outline-offset-[-2px] hover:outline-dunkelblau-100 border border-dunkelblau-100 rounded-[3px]"
			id={chatFormId}
		>
			<SelectedChatItemsCollapsible />

			<div className="flex flex-col justify-between rounded-b-3px">
				<div
					className={`rounded-[1px] my-2 pt-1 mx-3 px-1 flex z-10
								has-[textarea:focus]:outline
								has-[textarea:focus]:outline-[2px]
								has-[textarea:focus]:outline-offset-0
								has-[textarea:focus]:outline-mittelblau-100
								has-[textarea:active]:outline
								has-[textarea:active]:outline-[2px]
								has-[textarea:active]:outline-offset-1
								has-[textarea:active]:outline-dunkelblau-100
								items-end
								`}
				>
					<textarea
						className="w-full focus:outline-none min-h-6 max-h-44 resize-none overflow-y-auto text-base leading-6 text-dunkelblau-100 placeholder:text-dunkelblau-80"
						ref={textareaRef}
						name="content"
						rows={1}
						required={true}
						placeholder={Content["chat.textarea.placeholder"]}
						onKeyDown={handleTextAreaKeyDown}
						onInput={handleTextAreaInput}
					/>
				</div>
				<div className="pb-3 pt-1 px-4 flex w-full z-10 justify-between">
					<div className="flex items-center gap-3">
						<ChatOptionsToggleButton />
						<div className="items-center gap-2 hidden md:flex">
							{selectedChatOptions.map((option) => (
								<ContextPill
									key={option}
									option={option}
									onClose={() => toggleChatOption(option)}
								/>
							))}
						</div>
					</div>
					<div className="flex items-center gap-3">
						<LlmModelToggleButton />
						{isInferenceLoading && !hasError ? (
							<button
								type="button"
								aria-label={Content["chat.stopGeneratingButton.ariaLabel"]}
								onClick={() => abortStreaming()}
								className="rounded-3px size-8 bg-hellblau-50 flex items-center justify-center shrink-0 hover:bg-hellblau-110 focus-visible:outline-2px"
							>
								<ChatStopGeneratingIcon />
							</button>
						) : (
							<button
								type="submit"
								disabled={!textareaContent.trim()}
								aria-label={Content["chat.sendButton.ariaLabel"]}
								className={`rounded-3px size-8 bg-dunkelblau-100 disabled:bg-dunkelblau-30 p-1.5 hover:bg-dunkelblau-90 focus-visible:outline-2px`}
							>
								<ArrowWhiteRightIcon />
							</button>
						)}
					</div>
				</div>
			</div>
		</form>
	);
};
