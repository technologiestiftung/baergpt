import { useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import type { NewChatMessage } from "../../../common";
import { useChatsStore } from "../../../store/use-chats-store";
import { useAuthStore } from "../../../store/auth-store";
import { useInferenceLoadingStatusStore } from "../../../store/use-inference-loading-status-store.ts";
import { useErrorStore } from "../../../store/error-store.ts";
import { captureError } from "../../../monitoring/capture-error.ts";
import { useUpdateChatOnStreamData } from "./use-update-chat-on-stream-data.tsx";
import { useStopStreamingOnChatChange } from "./use-stop-streaming-on-chat-change.tsx";
import { useUpdateInferenceLoadingStatusOnStreamData } from "./use-update-inference-loading-status-on-stream-data.tsx";
import { useCitationsStore } from "../../../store/use-citations-store.ts";

const DEFAULT_SEARCH_TYPE = "all_private" as const;

type StartStreamingArgs = {
	userMessage: NewChatMessage;
	requestContext: {
		userId?: string;
		chatId?: number;
		isAddressedFormal?: boolean | null;
		allowedDocumentIds: number[] | null;
		allowedFolderIds: number[] | null;
		searchType?: "all_private" | "all_public";
	};
};

export function useChatStreaming() {
	const { setStatus, setError, clearError } =
		useInferenceLoadingStatusStore.getState();
	const { getMessageForKey } = useErrorStore.getState();
	const { getCurrentOrCreateChat, addMessageToChat, updateMessage } =
		useChatsStore.getState();

	const assistantMessageIdRef = useRef<number | null>(null);
	const citationsRef = useRef<number[]>([]);
	const requestContextRef = useRef<StartStreamingArgs["requestContext"] | null>(
		null,
	);
	const { ensureCached } = useCitationsStore.getState();

	const { messages, status, stop, sendMessage } = useChat({
		transport: new DefaultChatTransport({
			api: `${import.meta.env.VITE_API_URL}/llm/just-chatting`,
			fetch: async (input, init) => {
				const token = useAuthStore.getState().session?.access_token;
				const headers = new Headers(init?.headers);
				headers.set("Content-Type", "application/json");
				headers.set("Authorization", token ? `Bearer ${token}` : "");

				return fetch(input, { ...init, headers });
			},
			prepareSendMessagesRequest: ({ messages: chatMessages }) => {
				const context = requestContextRef.current;
				const chat = useChatsStore.getState().getCurrentChat();

				return {
					body: {
						messages:
							chat?.messages
								.filter(
									(message) =>
										!(
											message.role === "assistant" &&
											!message.content?.trim() &&
											!message.citations?.length
										),
								)
								.map(({ role, content }) => ({ role, content })) ??
							chatMessages,
						user_id: context?.userId,
						chat_id: chat?.id ?? context?.chatId,
						search_type: context?.searchType ?? DEFAULT_SEARCH_TYPE,
						allowed_document_ids: context?.allowedDocumentIds,
						allowed_folder_ids: context?.allowedFolderIds,
						is_addressed_formal: context?.isAddressedFormal,
					},
				};
			},
		}),
		onError: (error) => {
			captureError(error);

			// Get the user-readable error message
			const errorMessage =
				error instanceof Error ? getMessageForKey(error.message) : null;

			if (errorMessage) {
				// Show custom error in chat for known errors
				setError(errorMessage);
			} else {
				// For unknown errors, just reset to idle
				setStatus("idle");
			}
		},
		onData: (dataPart) => {
			// Handle custom data-citations stream part from backend
			if (dataPart.type === "data-citations" && Array.isArray(dataPart.data)) {
				citationsRef.current = dataPart.data as number[];
			}
		},
		onFinish: async ({ message }) => {
			setStatus("idle");

			const chat = useChatsStore.getState().getCurrentChat();
			const assistantMessageId = assistantMessageIdRef.current;

			if (!chat || !assistantMessageId) {
				return;
			}

			const chunkIds = citationsRef.current;
			if (chunkIds.length) {
				ensureCached(chunkIds);
			}

			updateMessage({
				chat,
				messageId: assistantMessageId,
				content: getTextFromMessage(message),
				citations: chunkIds.length ? chunkIds : null,
			});

			// Reset for next message
			citationsRef.current = [];
			requestContextRef.current = null;
		},
	});

	useUpdateChatOnStreamData({
		assistantMessageIdRef,
		messages,
	});

	useStopStreamingOnChatChange({
		stop,
	});

	useUpdateInferenceLoadingStatusOnStreamData(messages, status);

	async function startStreaming({
		userMessage,
		requestContext,
	}: StartStreamingArgs) {
		if (status === "submitted" || status === "streaming") {
			stop();
		}

		// Clear any previous errors
		clearError();

		// Store context for use in prepareSendMessagesRequest
		requestContextRef.current = requestContext;

		const chat = await getCurrentOrCreateChat(userMessage);

		const assistantMessageId = await addMessageToChat(chat, {
			content: "",
			type: "text",
			role: "assistant",
			allowed_document_ids: requestContext.allowedDocumentIds,
			allowed_folder_ids: requestContext.allowedFolderIds,
			citations: null,
		});
		assistantMessageIdRef.current = assistantMessageId;

		setStatus("waiting-for-response");

		sendMessage({ text: userMessage.content });
	}

	return { startStreaming };
}

function getTextFromMessage(message: UIMessage): string {
	return message.parts
		.filter(
			(part): part is { type: "text"; text: string } => part.type === "text",
		)
		.map((part) => part.text)
		.join("");
}
