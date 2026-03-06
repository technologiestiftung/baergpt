import { useChatsStore } from "../../store/use-chats-store.ts";
import { useErrorStore } from "../../store/error-store.ts";
import { useAuthStore } from "../../store/auth-store.ts";
import type { ChatWithMessages } from "../../common.ts";
import { useDocumentStore } from "../../store/document-store.ts";
import { useFolderStore } from "../../store/folder-store.ts";
import { useUserStore } from "../../store/user-store.ts";
import { useInferenceLoadingStatusStore } from "../../store/use-inference-loading-status-store.ts";
import { useCitationsStore } from "../../store/use-citations-store.ts";
import { useChatStreamingStore } from "../../store/use-chat-streaming-store.ts";
import type { Span } from "@sentry/react";

type StreamEvent =
	| { type: "text-delta"; id: string; delta: string }
	| { type: "data-citations"; data: number[] };

export async function getCompletion(
	currentChat: ChatWithMessages,
	span: Span,
): Promise<void> {
	const { handleError } = useErrorStore.getState();
	const {
		updateMessage,
		addMessageToChat,
		selectedLlmModel,
		selectedChatOptions,
	} = useChatsStore.getState();
	const { getSelectedChatDocumentIds } = useDocumentStore.getState();
	const { getSelectedChatFolderIds } = useFolderStore.getState();
	const { setStatus } = useInferenceLoadingStatusStore.getState();
	const { ensureCached } = useCitationsStore.getState();

	const { session } = useAuthStore.getState();
	const { user } = useUserStore.getState();
	const { setStreamingAbortController, abortStreaming } =
		useChatStreamingStore.getState();

	try {
		// Abort any existing stream before starting a new one
		abortStreaming();

		// Initialize a new AbortController for this stream
		const abortController = new AbortController();
		setStreamingAbortController(abortController);
		const messages = currentChat.messages.map(({ role, content }) => ({
			role,
			content,
		}));

		// fetch selected document and folder IDs
		const selectedDocumentIds = getSelectedChatDocumentIds();
		const selectedFolderIds = getSelectedChatFolderIds();
		const documents = useDocumentStore.getState().documents;

		// fetch documents within the selected folders
		const folderDocumentIds = documents
			.filter(
				(doc) =>
					doc.folder_id !== undefined &&
					doc.folder_id !== null &&
					selectedFolderIds.includes(doc.folder_id),
			)
			.map((doc) => doc.id);

		// merge document IDs from selected documents and folders
		const allowedDocumentIds = Array.from(
			new Set([...selectedDocumentIds, ...folderDocumentIds]),
		);

		setStatus("waiting-for-response");

		// Create the assistant message first, so we have the messageId for the backend
		const messageId = await addMessageToChat(currentChat, {
			content: "",
			type: "text",
			role: "assistant",
			allowed_document_ids: selectedDocumentIds, // Save selected document IDs
			allowed_folder_ids: selectedFolderIds, // Save selected folder IDs
			citations: null,
		});

		const headers = new Headers();
		headers.set("Content-Type", "application/json");
		headers.set("Authorization", `Bearer ${session?.access_token}`);

		const response: Response = await fetch(
			`${import.meta.env.VITE_API_URL}/llm/just-chatting`,
			{
				method: "POST",
				headers,
				signal: abortController.signal,
				body: JSON.stringify({
					messages,
					message_id: messageId,
					user_id: session?.user.id,
					chat_id: currentChat.id ?? undefined,
					search_type: "all_private",
					allowed_document_ids: allowedDocumentIds,
					allowed_folder_ids: selectedFolderIds,
					is_addressed_formal: user?.is_addressed_formal,
					is_base_knowledge_active:
						selectedChatOptions.includes("baseKnowledge"),
					llm_model: selectedLlmModel,
					is_parla_mcp_tool_active: selectedChatOptions.includes("parla"),
				}),
			},
		);

		if (!response.ok) {
			const errorResponse = await response.json();
			setStatus("error");
			handleError(new Error(errorResponse.code), span);
			return;
		}

		if (!response.body) {
			setStatus("error");
			handleError(new Error("Response body from API is empty"), span);
			return;
		}

		let currentText = "";
		let citations: number[] = [];
		let hasReceivedText = false;

		await parseStream(response.body, {
			onTextDelta: (delta: string) => {
				// Set status to loading-text on first text delta
				if (!hasReceivedText) {
					setStatus("loading-text");
					hasReceivedText = true;
				}

				currentText += delta;
				updateMessage({
					chat: currentChat,
					messageId,
					content: currentText,
					citations: citations.length ? citations : null,
				});
			},
			// Update message immediately when citations arrive
			onCitations: (citationIds: number[]) => {
				citations = [...citations, ...citationIds];
				updateMessage({
					chat: currentChat,
					messageId,
					content: currentText,
					citations: citations.length ? citations : null,
				});
				// Cache the citations now
				if (citationIds.length) {
					ensureCached(citationIds);
				}
			},
			onFinish: () => {
				setStatus("idle");
				setStreamingAbortController(null);
			},
		});
	} catch (error) {
		setStatus("error");
		// Only handle error if it's not an abort error
		if (error instanceof Error && error.name !== "AbortError") {
			handleError(error, span);
		}
		setStreamingAbortController(null);
	}
}

function processStreamLine(
	line: string,
	callbacks: {
		onTextDelta: (delta: string) => void;
		onCitations: (citationIds: number[]) => void;
		onFinish: () => void;
	},
): boolean {
	if (!line.startsWith("data: ")) {
		return false;
	}

	const jsonStr = line.slice(6).trim();

	if (jsonStr === "[DONE]") {
		callbacks.onFinish();
		return true;
	}

	try {
		const event = JSON.parse(jsonStr) as StreamEvent;

		if (event.type === "text-delta") {
			callbacks.onTextDelta(event.delta);
			return false;
		}

		if (event.type === "data-citations") {
			callbacks.onCitations(event.data);
			return false;
		}

		return false;
	} catch (_e) {
		useErrorStore
			.getState()
			.handleError(new Error("Failed to parse SSE event"));
		return false;
	}
}

async function parseStream(
	body: ReadableStream<Uint8Array>,
	callbacks: {
		onTextDelta: (delta: string) => void;
		onCitations: (citationIds: number[]) => void;
		onFinish: () => void;
	},
) {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	let finishCalled = false;

	while (true) {
		const { done, value } = await reader.read();
		if (done) {
			break;
		}

		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split("\n");
		buffer = lines.pop() || "";

		for (const line of lines) {
			const isFinished = processStreamLine(line, callbacks);
			if (isFinished) {
				finishCalled = true;
			}
		}
	}

	if (!finishCalled) {
		useErrorStore
			.getState()
			.handleError(
				new Error(
					"stream was done before reaching the the last streaming line ([DONE])",
				),
			);
		callbacks.onFinish();
	}
}
