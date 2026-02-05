import { create } from "zustand";

interface DocumentsListStore {
	isMultiSelectForActionVisible: boolean;
	showMultiSelectForAction: () => void;
	hideMultiSelectForAction: () => void;
}

export const useDocumentsListStore = create<DocumentsListStore>((set) => ({
	isMultiSelectForActionVisible: false,
	showMultiSelectForAction: () => set({ isMultiSelectForActionVisible: true }),
	hideMultiSelectForAction: () => set({ isMultiSelectForActionVisible: false }),
}));
