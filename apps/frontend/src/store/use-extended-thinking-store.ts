import { create } from "zustand";
import { persist } from "zustand/middleware";
import { config } from "../config.ts";

const STORAGE_KEY = "extended-thinking";

interface ExtendedThinkingStore {
	isExtendedThinkingEnabled: boolean;
	setIsExtendedThinkingEnabled(isEnabled: boolean): void;
}

export const useExtendedThinkingStore = create<ExtendedThinkingStore>()(
	persist(
		(set) => ({
			isExtendedThinkingEnabled: false,

			setIsExtendedThinkingEnabled: (isExtendedThinkingEnabled: boolean) => {
				if (!config.featureFlagExtendedThinkingAllowed) {
					return;
				}

				set({ isExtendedThinkingEnabled });
			},
		}),
		{
			name: STORAGE_KEY,
			// A value persisted while the flag was on must not survive turning it off.
			merge: (persistedState, currentState) => ({
				...currentState,
				isExtendedThinkingEnabled:
					config.featureFlagExtendedThinkingAllowed &&
					(persistedState as Partial<ExtendedThinkingStore> | undefined)
						?.isExtendedThinkingEnabled === true,
			}),
		},
	),
);
