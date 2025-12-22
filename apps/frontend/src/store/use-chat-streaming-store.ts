import { create } from "zustand";

interface ChatStreamingStore {
	streamingAbortController: AbortController | null;
	setStreamingAbortController: (controller: AbortController | null) => void;
	abortStreaming: () => void;
}

export const useChatStreamingStore = create<ChatStreamingStore>()(
	(set, get) => ({
		streamingAbortController: null,
		setStreamingAbortController: (controller) =>
			set({ streamingAbortController: controller }),
		abortStreaming: () => {
			const { streamingAbortController } = get();
			if (streamingAbortController) {
				streamingAbortController.abort();
				// Clear the controller after aborting
				set({ streamingAbortController: null });
			}
		},
	}),
);
