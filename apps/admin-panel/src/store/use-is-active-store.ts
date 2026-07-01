import { create } from "zustand";
import { getIsActive } from "../api/user/get-is-active.ts";

interface IsActiveStore {
	isActive: boolean | null;
	getIsActive: (signal: AbortSignal) => Promise<void>;
	resetIsActive: () => void;
}

export const useIsActiveStore = create<IsActiveStore>((set) => ({
	isActive: null,
	getIsActive: async (signal: AbortSignal) => {
		try {
			const isActive = await getIsActive(signal);
			set({ isActive });
		} catch (error) {
			console.error("Failed to fetch user active status:", error);
			set({ isActive: false });
		}
	},
	resetIsActive: () => set({ isActive: null }),
}));
