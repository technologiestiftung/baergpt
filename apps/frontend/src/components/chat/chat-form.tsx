import React, {
	type FormEvent,
	type KeyboardEvent,
	useRef,
	useState,
} from "react";
import { useChatScrollingStore } from "../../store/use-chat-scrolling-store.ts";
import { useInferenceLoadingStatusStore } from "../../store/use-inference-loading-status-store.ts";
import { SelectedChatItemsCollapsible } from "./selected-chat-items/selected-chat-items-collapsible.tsx";
import { ArrowWhiteRightIcon } from "../primitives/icons/arrow-white-right-icon.tsx";
import { useFolderStore } from "../../store/folder-store.ts";
import { useDocumentStore } from "../../store/document-store.ts";
import Content from "../../content.ts";
import type { NewChatMessage } from "../../common.ts";
import { useAuthStore } from "../../store/auth-store.ts";
import { useUserStore } from "../../store/user-store.ts";
import { useChatStreaming } from "./hooks/use-chat-streaming";
const { setHasUserScrolledUp } = useChatScrollingStore.getState();

export const ChatForm: React.FC = () => {
	const { status, clearError } = useInferenceLoadingStatusStore();
	const { selectedChatFolders } = useFolderStore();
	const { selectedChatDocuments } = useDocumentStore();
	const { startStreaming } = useChatStreaming();
	const { session } = useAuthStore.getState();
	const { user } = useUserStore.getState();
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
			allowed_document_ids: selectedChatDocuments.map((doc) => doc.id),
			allowed_folder_ids: selectedChatFolders.map((folder) => folder.id),
		};
		const requestContext = {
			userId: session?.user.id,
			isAddressedFormal: user?.is_addressed_formal,
			allowedDocumentIds: selectedChatDocuments.map((doc) => doc.id),
			allowedFolderIds: selectedChatFolders.map((folder) => folder.id),
		};
		await startStreaming({ userMessage, requestContext });
	};

	const isInferenceLoading = [
		"waiting-for-response",
		"loading-text",
		"loading-citations",
	].includes(status);

	const isInError = status === "error";

	return (
		<form
			onSubmit={handleSubmit}
			className="flex flex-col max-h-[290px] focus-visible:outline-2px hover:outline hover:outline-2 hover:outline-offset-[-2px] hover:outline-dunkelblau-100 border border-dunkelblau-100 rounded-[3px]"
		>
			<SelectedChatItemsCollapsible />

			<div className="flex items-center p-0.5 gap-6 justify-between rounded-b-3px">
				<div
					className={`rounded-t-[1px] rounded-b-[1px] py-3 pl-4 flex w-full z-10
								has-[textarea:focus]:outline
								has-[textarea:focus]:outline-[2px]
								has-[textarea:focus]:outline-offset-1
								has-[textarea:focus]:outline-mittelblau-100
								has-[textarea:active]:outline
								has-[textarea:active]:outline-[2px]
								has-[textarea:active]:outline-offset-1
								has-[textarea:active]:outline-dunkelblau-100
								items-end
								`}
				>
					<textarea
						className="w-full pb-1 focus:outline-none min-h-6 max-h-44 resize-none overflow-y-auto text-base leading-6 text-dunkelblau-100 placeholder:text-dunkelblau-80"
						ref={textareaRef}
						name="content"
						rows={1}
						required={true}
						placeholder={Content["chat.textarea.placeholder"]}
						onKeyDown={handleTextAreaKeyDown}
						onInput={handleTextAreaInput}
					/>

					<button
						type="submit"
						disabled={
							(isInferenceLoading && !isInError) || !textareaContent.trim()
						}
						className={`rounded-3px bg-dunkelblau-100 disabled:bg-dunkelblau-30 p-1.5 hover:bg-dunkelblau-90 focus-visible:outline-2px mr-4`}
					>
						<ArrowWhiteRightIcon />
					</button>
				</div>
			</div>
		</form>
	);
};
