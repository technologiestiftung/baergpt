import React, {
	type FormEvent,
	type KeyboardEvent,
	type MouseEvent,
	useEffect,
	useRef,
	useState,
} from "react";
import { useInferenceLoadingStatusStore } from "../../../store/use-inference-loading-status-store.ts";
import { SelectedChatItemsCollapsible } from "../selected-chat-items/selected-chat-items-collapsible.tsx";
import { useChatStreamingStore } from "../../../store/use-chat-streaming-store.ts";
import { useUserFolderStore } from "../../../store/use-user-folder-store.ts";
import { useUserDocumentStore } from "../../../store/use-user-document-store.ts";
import { useFileUploadsStore } from "../../../store/use-file-uploads-store.ts";
import Content from "../../../content.ts";
import type { NewChatMessage } from "../../../common.ts";
import { getCompletion } from "../../../api/chat/get-completion.ts";
import {
	useChatsStore,
	externalChatTools,
} from "../../../store/use-chats-store.ts";
import { ChatMenuToggleButton } from "./chat-menu/chat-menu-toggle-button.tsx";
import { LlmModelToggleButton } from "./llm-model-toggle-button.tsx";
import { ContextPill } from "../../primitives/pill/context-pill.tsx";
import * as Sentry from "@sentry/react";
import { ExternalToolWarningBanner } from "./external-tool-warning-banner.tsx";
import { usePublicDocumentsStore } from "../../../store/use-public-documents-store.ts";
import { useCurrentChatIdStore } from "../../../store/current-chat-id-store.ts";
import { ChatSubmitButton } from "./chat-submit-button.tsx";

export const chatFormId = "chat-form";

interface ChatFormHandle {
	focus: () => void;
	setContent: (content: string) => void;
}

let activeChatForm: ChatFormHandle | null = null;

export const focusChatForm = () => {
	activeChatForm?.focus();
};

export const setChatInputContent = (content: string) => {
	activeChatForm?.setContent(content);
};

interface ChatFormProps {
	isCompact?: boolean;
	onContentChange?: (content: string) => void;
}

export const ChatForm: React.FC<ChatFormProps> = ({
	isCompact,
	onContentChange,
}) => {
	const { status, clearError, isLoading } = useInferenceLoadingStatusStore();
	const { selectedUserChatFolders: selectedUserChatFolders } =
		useUserFolderStore();
	const { getSelectedPublicChatDocumentIds } = usePublicDocumentsStore();
	const { selectedUserChatDocuments } = useUserDocumentStore();
	const { getCurrentOrCreateChat, selectedChatTools, toggleChatTool } =
		useChatsStore();
	const { showInfoMessage } = useChatsStore.getState();
	const { abortStreaming } = useChatStreamingStore.getState();
	const { isUploadingOver } = useFileUploadsStore();

	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const [textareaContent, setTextareaContent] = useState("");
	const { currentChatId, newChatCount } = useCurrentChatIdStore();

	// Resize textarea on input
	const handleTextAreaInput = () => {
		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
			textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
			setTextareaContent(textareaRef.current.value);
			onContentChange?.(textareaRef.current.value);
		}
	};

	const setContent = (content: string) => {
		const textareaElement = textareaRef.current;
		if (!textareaElement) {
			return;
		}

		textareaElement.value = content;
		handleTextAreaInput();
		textareaElement.focus();
		textareaElement.setSelectionRange(content.length, content.length);
	};

	useEffect(() => {
		const handle: ChatFormHandle = {
			focus: () => textareaRef.current?.focus(),
			setContent,
		};
		activeChatForm = handle;
		textareaRef.current?.focus();

		return () => {
			if (activeChatForm === handle) {
				activeChatForm = null;
			}
		};
	}, [currentChatId, isCompact]);

	// Discard a leftover draft when a new chat is started
	useEffect(() => {
		setContent("");
	}, [newChatCount]);

	// Handle Enter key to submit the form
	// and create a new line with Shift + Enter
	const handleTextAreaKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
		const isEnterWithoutShiftPressed = event.key === "Enter" && !event.shiftKey;
		if (isEnterWithoutShiftPressed) {
			event.preventDefault();
		}

		const isSubmitEnabled =
			!isLoading() &&
			isUploadingOver() &&
			event.currentTarget.value.trim().length > 0;
		if (isEnterWithoutShiftPressed && isSubmitEnabled) {
			event.currentTarget.form?.requestSubmit();
		}
	};

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		const form = event.currentTarget;
		const textarea = textareaRef.current;

		// Check if textarea only contains whitespace
		const messageText = form.content.value.trim();
		if (!messageText) {
			return;
		}

		// Clear any previous errors
		clearError();

		showInfoMessage(null);

		// Clear textarea on submit
		if (textarea) {
			textarea.value = "";
			handleTextAreaInput(); // Reset height
		}

		const allowed_document_ids = [
			...selectedUserChatDocuments.map(({ id }) => id),
			...getSelectedPublicChatDocumentIds(),
		];

		const userMessage: NewChatMessage = {
			type: "text",
			role: "user",
			content: messageText,
			citations: null,
			web_citations: null,
			parla_citations: null,
			open_data_citations: null,
			allowed_document_ids,
			allowed_folder_ids: selectedUserChatFolders.map((folder) => folder.id),
			external_tool_context: selectedChatTools.some((tool) =>
				externalChatTools.includes(tool),
			),
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

	const handleStop = (event: MouseEvent<HTMLButtonElement>) => {
		event.preventDefault();
		abortStreaming();
	};

	const hasError = status === "error";

	const isWebSearchActive = selectedChatTools.includes("webSearch");
	const isParlaActive = selectedChatTools.includes("parla");
	const isOpenDataActive = selectedChatTools.includes("openData");
	const isDatawrapperActive = selectedChatTools.includes("datawrapper");
	const activeToolsCount = [
		isWebSearchActive,
		isParlaActive,
		isOpenDataActive,
		isDatawrapperActive,
	].filter(Boolean).length;
	const areMultipleSourcesActive = activeToolsCount > 1;

	const getTextAreaPlaceholder = () => {
		if (areMultipleSourcesActive) {
			return Content["chat.textarea.placeholder.multipleSources"];
		}
		if (isParlaActive) {
			return Content["chat.textarea.placeholder.parla"];
		}
		if (isOpenDataActive) {
			return Content["chat.textarea.placeholder.openData"];
		}
		if (isDatawrapperActive) {
			return Content["chat.textarea.placeholder.datawrapper"];
		}
		if (isWebSearchActive) {
			return Content["chat.textarea.placeholder.webSearch"];
		}
		return Content["chat.textarea.placeholder"];
	};

	const contextPills = selectedChatTools.map((tool) => (
		<ContextPill key={tool} tool={tool} onClose={() => toggleChatTool(tool)} />
	));

	return (
		<form
			onSubmit={handleSubmit}
			className={`relative flex flex-col max-h-[290px] focus-visible:outline-2px hover:outline hover:outline-offset-[-2px] hover:outline-dunkelblau-100 border border-dunkelblau-100 rounded-[3px]
				${isWebSearchActive && "border-[2px] bg-hellblau-40 focus-visible:outline-3px hover:outline hover:outline-offset-[-1px]"}`}
			id={chatFormId}
		>
			<SelectedChatItemsCollapsible />
			<ExternalToolWarningBanner />

			{isCompact ? (
				<div className="flex flex-col rounded-b-3px pt-[15px] pb-3 pl-3 pr-4">
					{contextPills.length > 0 && (
						<div className="items-center gap-2 pb-2 hidden md:flex flex-wrap">
							{contextPills}
						</div>
					)}
					<div className="flex items-center gap-1 w-full">
						<ChatMenuToggleButton />
						<div className="rounded-[1px] flex z-10 has-[textarea:focus]:outline has-[textarea:focus]:outline-[2px] has-[textarea:focus]:outline-offset-0 has-[textarea:focus]:outline-mittelblau-100 has-[textarea:active]:outline has-[textarea:active]:outline-[2px] has-[textarea:active]:outline-offset-1 has-[textarea:active]:outline-dunkelblau-100 flex-1 min-w-0 px-1">
							<textarea
								className={`w-full focus:outline-none min-h-6 max-h-32 resize-none overflow-y-auto text-base leading-6 text-dunkelblau-100 placeholder:text-dunkelblau-80`}
								ref={textareaRef}
								name="content"
								rows={1}
								required={true}
								placeholder={getTextAreaPlaceholder()}
								onKeyDown={handleTextAreaKeyDown}
								onInput={handleTextAreaInput}
							/>
						</div>
						<div className="flex items-center gap-2.5 shrink-0">
							<LlmModelToggleButton />
							<ChatSubmitButton
								showLoading={isLoading() && !hasError}
								handleStop={handleStop}
								isDisabled={!textareaContent.trim() || !isUploadingOver()}
							/>
						</div>
					</div>
				</div>
			) : (
				<div className="flex flex-col justify-between rounded-b-3px">
					<div className="rounded-[1px] flex z-10 has-[textarea:focus]:outline has-[textarea:focus]:outline-[2px] has-[textarea:focus]:outline-offset-0 has-[textarea:focus]:outline-mittelblau-100 has-[textarea:active]:outline has-[textarea:active]:outline-[2px] has-[textarea:active]:outline-offset-1 has-[textarea:active]:outline-dunkelblau-100 my-2 pt-1 mx-3 px-1 items-end">
						<textarea
							className={`w-full focus:outline-none min-h-6 max-h-32 resize-none overflow-y-auto text-base leading-6 text-dunkelblau-100 placeholder:text-dunkelblau-80`}
							ref={textareaRef}
							name="content"
							rows={1}
							required={true}
							placeholder={getTextAreaPlaceholder()}
							onKeyDown={handleTextAreaKeyDown}
							onInput={handleTextAreaInput}
						/>
					</div>
					<div className="pb-3 pt-1 px-4 flex w-full z-10 justify-between">
						<div className="flex items-center gap-3">
							<ChatMenuToggleButton />
							<div className="items-center gap-2 hidden md:flex">
								{contextPills}
							</div>
						</div>
						<div className="flex items-center gap-3">
							<LlmModelToggleButton />
							<ChatSubmitButton
								showLoading={isLoading() && !hasError}
								handleStop={handleStop}
								isDisabled={!textareaContent.trim() || !isUploadingOver()}
							/>
						</div>
					</div>
				</div>
			)}
		</form>
	);
};
