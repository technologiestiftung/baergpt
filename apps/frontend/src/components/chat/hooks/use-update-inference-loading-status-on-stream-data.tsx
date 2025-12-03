import { useEffect } from "react";
import type { UIMessage } from "ai";
import { useInferenceLoadingStatusStore } from "../../../store/use-inference-loading-status-store.ts";

type ChatStatus = "ready" | "submitted" | "streaming" | "error";

export function useUpdateInferenceLoadingStatusOnStreamData(
	messages: UIMessage[],
	chatStatus: ChatStatus,
) {
	const { status, setStatus } = useInferenceLoadingStatusStore();
	const lastMessage = messages.at(-1);

	useEffect(() => {
		const shouldTransitionToLoadingText =
			chatStatus === "streaming" &&
			status !== "loading-text" &&
			status !== "loading-citations";

		if (shouldTransitionToLoadingText) {
			if (lastMessage?.role === "assistant") {
				const hasTextContent = lastMessage.parts.some(
					(part) => part.type === "text" && part.text.length > 0,
				);
				if (hasTextContent) {
					setStatus("loading-text");
				}
			}
		}
	}, [messages, chatStatus, status, setStatus]);
}
