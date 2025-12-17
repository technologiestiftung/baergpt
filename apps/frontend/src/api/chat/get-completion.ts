import { useChatsStore } from "../../store/use-chats-store.ts";
import { useErrorStore } from "../../store/error-store.ts";
import { useAuthStore } from "../../store/auth-store.ts";
import type { ChatWithMessages } from "../../common.ts";
import { useDocumentStore } from "../../store/document-store.ts";
import { useFolderStore } from "../../store/folder-store.ts";
import { useUserStore } from "../../store/user-store.ts";
import { useInferenceLoadingStatusStore } from "../../store/use-inference-loading-status-store.ts";
import { useCitationsStore } from "../../store/use-citations-store.ts";

const { handleError } = useErrorStore.getState();
const { updateMessage, addMessageToChat } = useChatsStore.getState();
const { getSelectedChatDocumentIds } = useDocumentStore.getState();
const { getSelectedChatFolderIds } = useFolderStore.getState();
const { setStatus } = useInferenceLoadingStatusStore.getState();
const { ensureCached } = useCitationsStore.getState();

type StreamEvent =
	| { type: "text-delta"; id: string; delta: string }
	| { type: "text-end"; id: string }
	| { type: "finish-step" }
	| { type: "finish" }
	| { type: "data-citations"; data: number[] };

export async function getCompletion(
	currentChat: ChatWithMessages,
): Promise<void> {
	const { session } = useAuthStore.getState();
	const { user } = useUserStore.getState();

	try {
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

		const headers = new Headers();
		headers.set("Content-Type", "application/json");
		headers.set("Authorization", `Bearer ${session?.access_token}`);

		setStatus("waiting-for-response");

		const response: Response = await fetch(
			`${import.meta.env.VITE_API_URL}/llm/just-chatting`,
			{
				method: "POST",
				headers,
				body: JSON.stringify({
					messages,
					user_id: session?.user.id,
					chat_id: currentChat.id ?? undefined,
					search_type: "all_private",
					allowed_document_ids: allowedDocumentIds,
					allowed_folder_ids: selectedFolderIds,
					is_addressed_formal: user?.is_addressed_formal,
				}),
			},
		);

		if (!response.ok) {
			const errorResponse = await response.json();
			setStatus("error");
			handleError(new Error(errorResponse.code));
			return;
		}

		if (!response.body) {
			setStatus("error");
			handleError(new Error("Response body from API is empty"));
			return;
		}

		const messageId = await addMessageToChat(currentChat, {
			content: "",
			type: "text",
			role: "assistant",
			allowed_document_ids: selectedDocumentIds, // Save selected document IDs
			allowed_folder_ids: selectedFolderIds, // Save selected folder IDs
			citations: null,
		});

		let currentText = "";
		let citations: number[] = [];
		let hasReceivedText = false;
		let isFinished = false;

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
			onCitations: (chunkIds: number[]) => {
				citations = chunkIds;
				// Update message immediately when citations arrive
				updateMessage({
					chat: currentChat,
					messageId,
					content: currentText,
					citations: citations.length ? citations : null,
				});
				// If we've already finished, cache the citations now
				if (isFinished && citations.length) {
					ensureCached(citations);
				}
			},
			onFinish: () => {
				setStatus("idle");
				isFinished = true;

				// Cache citations if any
				if (citations.length) {
					ensureCached(citations);
				}

				// Final update with citations
				updateMessage({
					chat: currentChat,
					messageId,
					content: currentText,
					citations: citations.length ? citations : null,
				});
			},
		});
	} catch (error) {
		setStatus("idle");
		handleError(error);
	}
}

function handleStreamEvent(
	event: StreamEvent,
	callbacks: {
		onTextDelta: (delta: string) => void;
		onCitations: (chunkIds: number[]) => void;
		onFinish: () => void;
	},
): boolean {
	switch (event.type) {
		case "text-delta":
			callbacks.onTextDelta(event.delta);
			return false;
		case "data-citations":
			callbacks.onCitations(event.data);
			return false;
		case "finish":
			callbacks.onFinish();
			return true;
		default:
			return false;
	}
}

function processStreamLine(
	line: string,
	callbacks: {
		onTextDelta: (delta: string) => void;
		onCitations: (chunkIds: number[]) => void;
		onFinish: () => void;
	},
): boolean {
	if (!line.startsWith("data: ")) {
		return false;
	}

	const jsonStr = line.slice(6).trim();
	if (jsonStr === "[DONE]") {
		return false;
	}

	try {
		const event = JSON.parse(jsonStr) as StreamEvent;
		return handleStreamEvent(event, callbacks);
	} catch (_e) {
		console.warn("Failed to parse SSE event:", jsonStr);
		return false;
	}
}

async function parseStream(
	body: ReadableStream<Uint8Array>,
	callbacks: {
		onTextDelta: (delta: string) => void;
		onCitations: (chunkIds: number[]) => void;
		onFinish: () => void;
	},
) {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	let finishCalled = false;

	try {
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
	} finally {
		if (!finishCalled) {
			callbacks.onFinish();
		}
	}
}
