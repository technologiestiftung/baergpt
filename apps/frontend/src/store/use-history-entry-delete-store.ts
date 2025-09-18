import { create } from "zustand";

interface CurrentChatIdStore {
	historyEntryToDeleteId: number | null;
	historyEntryToDeleteName: string;
	setHistoryEntryToDeleteId: (chatId: number | null) => void;
	setHistoryEntryToDeleteName: (chatName: string) => void;
}

export const useHistoryEntryDeleteStore = create<CurrentChatIdStore>()(
	(set) => ({
		historyEntryToDeleteId: null,
		historyEntryToDeleteName: "",
		setHistoryEntryToDeleteId: (chatId) => {
			set({ historyEntryToDeleteId: chatId });
		},
		setHistoryEntryToDeleteName: (chatName) => {
			set({ historyEntryToDeleteName: chatName });
		},
	}),
);
