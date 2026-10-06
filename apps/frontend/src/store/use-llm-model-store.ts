import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { LlmModel } from "../common";
import { config } from "../config";

const STORAGE_KEY = "llm-model";

/**
 * Models selectable in the current build. Shared with the toggle button so
 * the dropdown's item list and the persisted-value validation below never
 * drift apart.
 */
export const availableLlmModels: LlmModel[] = [
	"fast",
	"precise",
	...(config.featureFlagExperimentalModelAllowed
		? (["experimental"] as const)
		: []),
];

function isAvailableLlmModel(value: unknown): value is LlmModel {
	return (
		typeof value === "string" &&
		(availableLlmModels as string[]).includes(value)
	);
}

interface LlmModelStore {
	selectedLlmModel: LlmModel;
	setSelectedLlmModel(model: LlmModel): void;
}

export const useLlmModelStore = create<LlmModelStore>()(
	persist(
		(set) => ({
			selectedLlmModel: "fast",

			setSelectedLlmModel: (selectedLlmModel: LlmModel) =>
				set({ selectedLlmModel }),
		}),
		{
			name: STORAGE_KEY,
			// Falls back to the default state's "fast" whenever the persisted
			// value is missing, stale (e.g. an old model id from a past rename),
			// or no longer available (e.g. "experimental" with the flag off).
			merge: (persistedState, currentState) => {
				const selectedLlmModel =
					typeof persistedState === "object" &&
					persistedState !== null &&
					"selectedLlmModel" in persistedState &&
					isAvailableLlmModel(persistedState.selectedLlmModel)
						? persistedState.selectedLlmModel
						: currentState.selectedLlmModel;

				return { ...currentState, selectedLlmModel };
			},
		},
	),
);
