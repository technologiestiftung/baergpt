import { create } from "zustand";
import { useCurrentChatIdStore } from "./current-chat-id-store.ts";
import { useChatsStore } from "./use-chats-store.ts";

interface HistorySelectionStore {
	selectedChatIds: number[];
	anchorChatId: number | null;
	selectRangeTo: (chatId: number) => void;
	toggleChatSelection: (chatId: number) => void;
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

		toggleChatSelection: (chatId) => {
			const { selectedChatIds, anchorChatId } = get();
			const { currentChatId } = useCurrentChatIdStore.getState();

			const baseSelection =
				selectedChatIds.length > 0
					? selectedChatIds
					: [currentChatId].filter((id): id is number => id !== null);

			const isRemovingFromExistingSelection =
				selectedChatIds.length > 0 && baseSelection.includes(chatId);
			const nextSelection = baseSelection.includes(chatId)
				? baseSelection.filter((id) => id !== chatId)
				: [...baseSelection, chatId];

			set({
				selectedChatIds: nextSelection,
				anchorChatId: isRemovingFromExistingSelection ? anchorChatId : chatId,
			});
		},

		clearSelection: () => {
			set({ selectedChatIds: [], anchorChatId: null });
		},
	}),
);

export const useSelectedChatCount = (chatId: number) =>
	useHistorySelectionStore(({ selectedChatIds }) =>
		selectedChatIds.includes(chatId) ? selectedChatIds.length : 1,
	);

useCurrentChatIdStore.subscribe((state, previousState) => {
	if (state.currentChatId !== previousState.currentChatId) {
		useHistorySelectionStore.getState().clearSelection();
	}
});
