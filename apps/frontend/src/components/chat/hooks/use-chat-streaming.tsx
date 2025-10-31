import { useRef } from "react";
import { experimental_useObject as useObject } from "@ai-sdk/react";
import { streamedObjectSchema } from "../../../schemas/streamed-object-schema.ts";
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
	const { ensureCached } = useCitationsStore.getState();

	const { object, submit, stop, isLoading } = useObject({
		api: `${import.meta.env.VITE_API_URL}/llm/just-chatting`,
		schema: streamedObjectSchema,
		fetch: (input, init) => {
			const token = useAuthStore.getState().session?.access_token;
			const headers = new Headers(init?.headers);
			headers.set("Content-Type", "application/json");
			headers.set("Authorization", token ? `Bearer ${token}` : "");

			return fetch(input, {
				...init,
				headers,
			});
		},
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
		onFinish: async ({ object: result }) => {
			setStatus("idle");

			if (!result) {
				return;
			}

			const chat = useChatsStore.getState().getCurrentChat();
			const assistantMessageId = assistantMessageIdRef.current;

			if (!chat || !assistantMessageId) {
				return;
			}

			const chunkIds = result.citations ?? [];
			if (chunkIds.length) {
				ensureCached(chunkIds);
			}

			updateMessage({
				chat,
				messageId: assistantMessageId,
				content: result.content,
				citations: chunkIds.length ? chunkIds : null,
			});
		},
	});

	useUpdateChatOnStreamData({
		assistantMessageIdRef,
		streamedObject: object,
	});

	useStopStreamingOnChatChange({
		stop,
	});

	useUpdateInferenceLoadingStatusOnStreamData(object);

	async function startStreaming({
		userMessage,
		requestContext,
	}: StartStreamingArgs) {
		if (isLoading) {
			stop();
		}

		// Clear any previous errors
		clearError();

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

		submit({
			messages: chat.messages
				.filter(
					(message) =>
						!(
							message.role === "assistant" &&
							!message.content?.trim() &&
							!message.citations?.length
						),
				)
				.map(({ role, content }) => ({ role, content })),
			user_id: requestContext.userId,
			chat_id: chat.id,
			search_type: requestContext.searchType ?? DEFAULT_SEARCH_TYPE,
			allowed_document_ids: requestContext.allowedDocumentIds,
			allowed_folder_ids: requestContext.allowedFolderIds,
			is_addressed_formal: requestContext.isAddressedFormal,
		});
	}

	return { startStreaming };
}
