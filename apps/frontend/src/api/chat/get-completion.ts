import { useChatsStore } from "../../store/use-chats-store.ts";
import { useErrorStore } from "../../store/error-store.ts";
import { useAuthStore } from "../../store/auth-store.ts";
import type { ChatTool, ChatWithMessages } from "../../common.ts";
import { useUserDocumentStore } from "../../store/use-user-document-store.ts";
import { useUserFolderStore } from "../../store/use-user-folder-store.ts";
import { useUserStore } from "../../store/user-store.ts";
import { useInferenceLoadingStatusStore } from "../../store/use-inference-loading-status-store.ts";
import { useCitationsStore } from "../../store/use-citations-store.ts";
import { useFaviconStore } from "../../store/favicon-store.ts";
import { useChatStreamingStore } from "../../store/use-chat-streaming-store.ts";
import type { Span } from "@sentry/react";
import { usePublicDocumentsStore } from "../../store/use-public-documents-store.ts";

export type WebCitationSource = {
	url: string;
	title: string;
	snippet: string;
	age?: string[] | null;
};

export type ParlaCitationSource = {
	url: string;
	title: string;
	source_type: string;
	content: string;
	page: number;
};

type StreamEvent =
	| { type: "text-delta"; id: string; delta: string }
	| { type: "data-citations"; data: number[] }
	| { type: "data-web-citations"; data: WebCitationSource[] }
	| { type: "data-parla-citations"; data: ParlaCitationSource[] };

const activeToolsDict: Record<ChatTool, string[]> = {
	parla: ["parlaMCPTools"],
	webSearch: ["webSearchTool"],
};

export async function getCompletion(
	currentChat: ChatWithMessages,
	span: Span,
): Promise<void> {
	const { handleError } = useErrorStore.getState();
	const {
		updateMessage,
		addMessageToChat,
		selectedLlmModel,
		selectedChatTools,
	} = useChatsStore.getState();
	const { getSelectedUserChatDocumentIds } = useUserDocumentStore.getState();
	const { getSelectedUserChatFolderIds } = useUserFolderStore.getState();
	const { getSelectedPublicChatDocumentIds } =
		usePublicDocumentsStore.getState();

	const { setStatus } = useInferenceLoadingStatusStore.getState();
	const { ensureCached } = useCitationsStore.getState();
	const { ensureFaviconsCached } = useFaviconStore.getState();

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

		const selectedDocumentIds = getSelectedUserChatDocumentIds();
		const selectedFolderIds = getSelectedUserChatFolderIds();
		const publicDocumentIds = getSelectedPublicChatDocumentIds();

		// merge document IDs from selected documents and folders
		const allowedDocumentIds = Array.from(
			new Set([...selectedDocumentIds, ...publicDocumentIds]),
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
				signal: abortController.signal,
				body: JSON.stringify({
					messages,
					user_id: session?.user.id,
					chat_id: currentChat.id ?? undefined,
					search_type: "all_private",
					allowed_document_ids: allowedDocumentIds,
					allowed_folder_ids: selectedFolderIds,
					is_addressed_formal: user?.is_addressed_formal,
					active_tools: selectedChatTools.flatMap(
						(option) => activeToolsDict[option] ?? [],
					),
					llm_model: selectedLlmModel,
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

		const messageId = await addMessageToChat(currentChat, {
			content: "",
			type: "text",
			role: "assistant",
			allowed_document_ids: allowedDocumentIds, // Save selected document IDs
			allowed_folder_ids: selectedFolderIds, // Save selected folder IDs
			citations: null,
			web_citations: null,
			parla_citations: null,
		});

		let currentText = "";
		let documentCitations: number[] = [];
		let webCitations: WebCitationSource[] = [];
		let parlaCitations: ParlaCitationSource[] = [];

		let hasReceivedText = false;

		const writeMessage = () =>
			updateMessage({
				chat: currentChat,
				messageId,
				content: currentText,
				citations: documentCitations.length ? documentCitations : null,
				web_citations: webCitations.length ? webCitations : null,
				parla_citations: parlaCitations.length ? parlaCitations : null,
			});

		await parseStream(response.body, {
			onTextDelta: (delta: string) => {
				// Set status to loading-text on first text delta
				if (!hasReceivedText) {
					setStatus("loading-text");
					hasReceivedText = true;
				}

				currentText += delta;
				writeMessage();
			},
			onCitations: (chunkIds: number[]) => {
				documentCitations = chunkIds;
				writeMessage();
				// Cache the citations now
				if (documentCitations.length) {
					ensureCached(documentCitations);
				}
			},
			onWebCitations: (webSources: WebCitationSource[]) => {
				webCitations = webSources;
				writeMessage();
				if (webSources.length) {
					ensureFaviconsCached(webSources.map(({ url }) => url));
				}
			},
			onParlaCitations: (sources: ParlaCitationSource[]) => {
				parlaCitations = sources;
				writeMessage();
			},
			onFinish: () => {
				setStatus("idle");
				setStreamingAbortController(null);
			},
		});
	} catch (error) {
		// Only handle error if it's not an abort error
		const isUserAbort = error instanceof Error && error.name === "AbortError";
		if (isUserAbort) {
			setStatus("idle");
		} else {
			setStatus("error");
			if (error instanceof Error) {
				handleError(error, span);
			}
		}
		setStreamingAbortController(null);
	}
}

function processStreamLine(
	line: string,
	callbacks: {
		onTextDelta: (delta: string) => void;
		onCitations: (chunkIds: number[]) => void;
		onWebCitations: (webCitationSources: WebCitationSource[]) => void;
		onParlaCitations: (sources: ParlaCitationSource[]) => void;
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

		if (event.type === "data-web-citations") {
			callbacks.onWebCitations(event.data);
			return false;
		}

		if (event.type === "data-parla-citations") {
			callbacks.onParlaCitations(event.data);
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
		onCitations: (chunkIds: number[]) => void;
		onWebCitations: (webCitationSources: WebCitationSource[]) => void;
		onParlaCitations: (sources: ParlaCitationSource[]) => void;
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
