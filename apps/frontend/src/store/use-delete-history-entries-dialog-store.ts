import { create } from "zustand";

export type DeleteHistoryEntriesTarget =
	| { type: "single"; chatId: number; chatName: string }
	| { type: "selected" }
	| { type: "all" };

interface DeleteHistoryEntriesDialogStore {
	target: DeleteHistoryEntriesTarget;
	setTarget: (target: DeleteHistoryEntriesTarget) => void;
}

export const useDeleteHistoryEntriesDialogStore =
	create<DeleteHistoryEntriesDialogStore>()((set) => ({
		target: { type: "selected" },
		setTarget: (target) => {
			set({ target });
		},
	}));
