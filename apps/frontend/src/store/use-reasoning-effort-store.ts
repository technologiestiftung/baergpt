import { create } from "zustand";
import { persist } from "zustand/middleware";
import { config } from "../config.ts";

const STORAGE_KEY = "reasoning-effort";
// Boolean store this one replaces; `true` there becomes "high" here.
const LEGACY_STORAGE_KEY = "extended-thinking";

export const REASONING_EFFORTS = ["none", "low", "medium", "high"] as const;
export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

export function isReasoningEffort(value: unknown): value is ReasoningEffort {
	return REASONING_EFFORTS.includes(value as ReasoningEffort);
}

function readLegacyReasoningEffort(): ReasoningEffort {
	try {
		const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
		const legacy = raw ? JSON.parse(raw) : null;
		return legacy?.state?.isExtendedThinkingEnabled === true ? "high" : "none";
	} catch {
		return "none";
	}
}

interface ReasoningEffortStore {
	reasoningEffort: ReasoningEffort;
	setReasoningEffort(reasoningEffort: ReasoningEffort): void;
}

export const useReasoningEffortStore = create<ReasoningEffortStore>()(
	persist(
		(set) => ({
			reasoningEffort: "none",

			setReasoningEffort: (reasoningEffort: ReasoningEffort) => {
				if (!config.featureFlagExtendedThinkingAllowed) {
					return;
				}

				set({ reasoningEffort });
			},
		}),
		{
			name: STORAGE_KEY,
			// A value persisted while the flag was on must not survive turning it off.
			// Without a persisted value, fall back to the old boolean store.
			merge: (persistedState, currentState) => {
				const persisted = (
					persistedState as Partial<ReasoningEffortStore> | undefined
				)?.reasoningEffort;
				const reasoningEffort = isReasoningEffort(persisted)
					? persisted
					: readLegacyReasoningEffort();

				return {
					...currentState,
					reasoningEffort: config.featureFlagExtendedThinkingAllowed
						? reasoningEffort
						: "none",
				};
			},
		},
	),
);
