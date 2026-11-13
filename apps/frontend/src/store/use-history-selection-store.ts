import { create } from "zustand";
import { useCurrentChatIdStore } from "./current-chat-id-store.ts";
import { useChatsStore } from "./use-chats-store.ts";

interface HistorySelectionStore {
	selectedChatIds: number[];
	anchorChatId: number | null;
	selectRangeTo: (chatId: number) => void;
	clearSelection: () => void;
}

export const useHistorySelectionStore = create<HistorySelectionStore>()(
	(set, get) => ({
		selectedChatIds: [],
		anchorChatId: null,

		selectRangeTo: (chatId) => {
			const orderedChatIds = useChatsStore.getState().chats.map(({ id }) => id);
			const { currentChatId } = useCurrentChatIdStore.getState();
			const anchorChatId = get().anchorChatId ?? currentChatId ?? chatId;

			const anchorIndex = orderedChatIds.indexOf(anchorChatId);
			const targetIndex = orderedChatIds.indexOf(chatId);

			if (targetIndex === -1) {
				return;
			}

			if (anchorIndex === -1 || anchorIndex === targetIndex) {
				// A single chat is not a multi-selection, it only sets the anchor
				set({ selectedChatIds: [], anchorChatId: chatId });
				return;
			}

			const start = Math.min(anchorIndex, targetIndex);
			const end = Math.max(anchorIndex, targetIndex);

			set({
				selectedChatIds: orderedChatIds.slice(start, end + 1),
				anchorChatId,
			});
		},

		clearSelection: () => {
			set({ selectedChatIds: [], anchorChatId: null });
		},
	}),
);

useCurrentChatIdStore.subscribe((state, previousState) => {
	if (state.currentChatId !== previousState.currentChatId) {
		useHistorySelectionStore.getState().clearSelection();
	}
});
