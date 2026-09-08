import { create } from "zustand";
import { persist } from "zustand/middleware";

const STORAGE_KEY = "extended-thinking";

interface ExtendedThinkingStore {
	isExtendedThinkingEnabled: boolean;
	setIsExtendedThinkingEnabled(isEnabled: boolean): void;
}

export const useExtendedThinkingStore = create<ExtendedThinkingStore>()(
	persist(
		(set) => ({
			isExtendedThinkingEnabled: false,

			setIsExtendedThinkingEnabled: (isExtendedThinkingEnabled: boolean) =>
				set({ isExtendedThinkingEnabled }),
		}),
		{ name: STORAGE_KEY },
	),
);
