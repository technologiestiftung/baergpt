import React, {
	type ChangeEvent,
	type FormEvent,
	type KeyboardEvent,
	type MouseEvent,
	useEffect,
	useLayoutEffect,
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

const singleLineHeightFallback = 24;

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
	onMultilineChange?: (isMultiline: boolean) => void;
}

export const ChatForm: React.FC<ChatFormProps> = ({
	isCompact,
	onContentChange,
	onMultilineChange,
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
	const shouldMoveCaretToEnd = useRef(false);
	const [textareaContent, setTextareaContent] = useState("");
	const [hasKeyboardFocus, setHasKeyboardFocus] = useState(false);
	const shouldSuppressFocusRing = useRef(false);
	const { currentChatId } = useCurrentChatIdStore();

	const handleTextAreaChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
		setTextareaContent(event.target.value);
		onContentChange?.(event.target.value);
	};

	const focusTextArea = () => {
		shouldSuppressFocusRing.current = true;
		textareaRef.current?.focus();
	};

	const setContent = (content: string) => {
		setTextareaContent(content);
		onContentChange?.(content);
		shouldMoveCaretToEnd.current = true;
		focusTextArea();
	};

	useLayoutEffect(() => {
		const textareaElement = textareaRef.current;
		if (!textareaElement) {
			return;
		}

		textareaElement.style.height = "auto";
		const contentHeight = textareaElement.scrollHeight;
		textareaElement.style.height = `${contentHeight}px`;

		const lineHeight =
			Number.parseFloat(getComputedStyle(textareaElement).lineHeight) ||
			singleLineHeightFallback;

		const overflowsSingleLine =
			textareaElement.scrollWidth > textareaElement.clientWidth;
		onMultilineChange?.(
			overflowsSingleLine || contentHeight > lineHeight * 1.5,
		);

		if (shouldMoveCaretToEnd.current) {
			shouldMoveCaretToEnd.current = false;
			textareaElement.setSelectionRange(
				textareaContent.length,
				textareaContent.length,
			);
		}
	}, [textareaContent, isCompact, onMultilineChange]);

	useEffect(() => {
		const handle: ChatFormHandle = {
			focus: focusTextArea,
			setContent,
		};
		activeChatForm = handle;
		focusTextArea();

		return () => {
			if (activeChatForm === handle) {
				activeChatForm = null;
			}
		};
	}, [currentChatId]);

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

		// Check if textarea only contains whitespace
		const messageText = form.content.value.trim();
		if (!messageText) {
			return;
		}

		// Clear any previous errors
		clearError();

		showInfoMessage(null);

		// Clear textarea on submit
		setTextareaContent("");
		onContentChange?.("");

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
			thinking_traces: null,
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
			className={`relative flex flex-col max-h-[290px] mx-[1px] focus-visible:outline-2px hover:outline hover:outline-offset-[-2px] hover:outline-dunkelblau-100 border border-dunkelblau-100 rounded-[3px]
				${isWebSearchActive && "border-[2px] bg-hellblau-40 focus-visible:outline-3px hover:outline hover:outline-offset-[-1px]"}`}
			id={chatFormId}
		>
			<SelectedChatItemsCollapsible />
			<ExternalToolWarningBanner />

			<div
				className={`flex flex-wrap items-center rounded-b-3px transition-[padding,row-gap,column-gap] duration-200 ease-out motion-reduce:transition-none ${
					isCompact
						? "gap-x-1 gap-y-2 pt-[15px] pb-3 pl-3 pr-4"
						: "gap-x-3 gap-y-3 pt-2 pb-3 px-3"
				}`}
			>
				<div
					onPointerDown={() => {
						shouldSuppressFocusRing.current = true;
					}}
					className={`rounded-[1px] flex z-10 ${
						hasKeyboardFocus
							? "outline outline-[2px] outline-offset-0 outline-mittelblau-100"
							: ""
					} has-[textarea:active]:outline has-[textarea:active]:outline-[2px] has-[textarea:active]:outline-offset-1 has-[textarea:active]:outline-dunkelblau-100 min-w-0 grow px-1 transition-[padding] duration-200 ease-out motion-reduce:transition-none ${
						isCompact ? "order-3 basis-0" : "order-1 basis-full items-end pt-1"
					}`}
				>
					<textarea
						className={`w-full focus:outline-none min-h-6 max-h-32 resize-none overflow-y-auto text-base leading-6 text-dunkelblau-100 placeholder:text-dunkelblau-80 ${
							isCompact ? "overflow-x-hidden" : ""
						}`}
						ref={textareaRef}
						name="content"
						rows={1}
						wrap={isCompact ? "off" : "soft"}
						required={true}
						value={textareaContent}
						placeholder={getTextAreaPlaceholder()}
						onKeyDown={handleTextAreaKeyDown}
						onChange={handleTextAreaChange}
						onFocus={() => {
							setHasKeyboardFocus(!shouldSuppressFocusRing.current);
							shouldSuppressFocusRing.current = false;
						}}
						onBlur={() => {
							setHasKeyboardFocus(false);
							shouldSuppressFocusRing.current = false;
						}}
					/>
				</div>

				<div className={`order-2 ${isCompact ? "" : "ml-1"}`}>
					<ChatMenuToggleButton />
				</div>

				{contextPills.length > 0 && (
					<div
						className={`items-center gap-2 hidden md:flex flex-wrap ${
							isCompact ? "order-1 basis-full" : "order-3"
						}`}
					>
						{contextPills}
					</div>
				)}

				<div
					className={`order-4 flex items-center shrink-0 z-10 transition-[column-gap,margin] duration-200 ease-out motion-reduce:transition-none ${
						isCompact ? "gap-2.5" : "gap-3 ml-auto mr-1"
					}`}
				>
					<LlmModelToggleButton />
					<ChatSubmitButton
						showLoading={isLoading() && !hasError}
						handleStop={handleStop}
						isDisabled={!textareaContent.trim() || !isUploadingOver()}
					/>
				</div>
			</div>
		</form>
	);
};
