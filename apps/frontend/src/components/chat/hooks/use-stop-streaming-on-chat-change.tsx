import { useEffect } from "react";
import { useCurrentChatIdStore } from "../../../store/current-chat-id-store.ts";

export function useStopStreamingOnChatChange({ stop }: { stop: () => void }) {
	const { currentChatId } = useCurrentChatIdStore();

	useEffect(() => {
		/**
		 * Stop streaming AFTER the chat id changes (only as cleanup)
		 */
		return () => stop();
	}, [currentChatId]);
}
