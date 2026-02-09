import { create } from "zustand";
import type { Document, DocumentFolder } from "../common";

interface DocumentsListStore {
	isMultiSelectForActionVisible: boolean;
	showMultiSelectForAction: () => void;
	hideMultiSelectForAction: () => void;

	singleItemSelectedForAction: Document | DocumentFolder | null;
	setSingleItemSelectedForAction: (
		item: Document | DocumentFolder | null,
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
