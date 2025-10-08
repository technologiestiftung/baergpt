import { type MutableRefObject, useEffect } from "react";
import { useChatsStore } from "../../../store/use-chats-store.ts";
import type { StreamedObject } from "../../../schemas/streamed-object-schema.ts";
import type { DeepPartial } from "ai";

export function useUpdateChatOnStreamData({
	assistantMessageIdRef,
	streamedObject,
}: {
	assistantMessageIdRef: MutableRefObject<number | null>;
	streamedObject: DeepPartial<StreamedObject> | undefined;
}) {
	useEffect(() => {
		const chat = useChatsStore.getState().getCurrentChat();
		const assistantMessageId = assistantMessageIdRef.current;

		if (!chat || !assistantMessageId) {
			return;
		}

		if (!streamedObject || streamedObject.content === undefined) {
			return;
		}

		useChatsStore.getState().updateMessage({
			chat,
			messageId: assistantMessageId,
			content: streamedObject.content,
			citations: null,
		});
	}, [streamedObject?.content, assistantMessageIdRef.current]);
}
