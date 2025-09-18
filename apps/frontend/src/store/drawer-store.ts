import { create } from "zustand";

export type DrawerId = "history" | "documents" | "profile";

interface DrawerStore {
	openDrawerId: DrawerId | null | undefined;
	setOpenDrawer: (id: DrawerId | null | undefined) => void;
}

export const useDrawerStore = create<DrawerStore>((set) => ({
	// initially on desktop the history sidebar should be open but not on mobile
	openDrawerId:
		typeof window !== "undefined" && window.innerWidth >= 768
			? "history"
			: null,
	setOpenDrawer: (id) => set({ openDrawerId: id }),
}));
