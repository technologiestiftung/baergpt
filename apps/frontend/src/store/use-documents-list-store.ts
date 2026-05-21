import { create } from "zustand";
import type { UserDocument, UserFolder } from "../common";

interface DocumentsListStore {
	isMultiSelectForActionVisible: boolean;
	showMultiSelectForAction: () => void;
	hideMultiSelectForAction: () => void;

	singleItemSelectedForAction: UserDocument | UserFolder | null;
	setSingleItemSelectedForAction: (
		item: UserDocument | UserFolder | null,
	) => void;
}

export const useDocumentsListStore = create<DocumentsListStore>((set) => ({
	isMultiSelectForActionVisible: false,
	showMultiSelectForAction: () => set({ isMultiSelectForActionVisible: true }),
	hideMultiSelectForAction: () => set({ isMultiSelectForActionVisible: false }),

	singleItemSelectedForAction: null,
	setSingleItemSelectedForAction: (item) => {
		set({ singleItemSelectedForAction: item });
	},
}));
