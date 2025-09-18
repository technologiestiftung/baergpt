import { create } from "zustand";
import { getIsActive } from "../api/user/get-is-active.ts";
import { getAccountActivationTimestamp } from "../api/user/get-account-activated-at.ts";
import { useErrorStore } from "./error-store.ts";

interface IsActiveStore {
	isActive: boolean | null;
	registrationFinishedAt: string | null | undefined;
	getIsActive: (signal: AbortSignal) => Promise<void>;
	resetIsActive: () => void;
	getAccountActivationTimestamp: () => Promise<void>;
}

export const useIsActiveStore = create<IsActiveStore>((set) => ({
	isActive: null,
	registrationFinishedAt: undefined,
	getIsActive: async (signal: AbortSignal) => {
		try {
			const isActive = await getIsActive(signal);
			set({ isActive });
		} catch (error) {
			useErrorStore.getState().handleError(error);
			set({ isActive: false });
		}
	},
	getAccountActivationTimestamp: async () => {
		try {
			const timestamp = await getAccountActivationTimestamp();
			set({ registrationFinishedAt: timestamp });
		} catch (error) {
			useErrorStore.getState().handleError(error);
			set({ registrationFinishedAt: undefined });
		}
	},
	resetIsActive: () => set({ isActive: null }),
}));
