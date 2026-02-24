import { create } from "zustand";
import { getCitationDetails } from "../api/citations/get-citation-details";
import { useInferenceLoadingStatusStore } from "./use-inference-loading-status-store.ts";
import type { CitationWithDetails } from "../common";

type CitationsStore = {
	citationById: Record<number, CitationWithDetails>;
	ensureCached: (citationIds: number[]) => Promise<void>;
	getCitation: (citationId: number) => CitationWithDetails | undefined;
};

export const useCitationsStore = create<CitationsStore>()((set, get) => ({
	citationById: {},

	getCitation: (citationId) => {
		return get().citationById[citationId];
	},

	async ensureCached(citationIds) {
		const { citationById } = get();
		const { setStatus } = useInferenceLoadingStatusStore.getState();

		const unique = Array.from(new Set(citationIds));
		const missing = unique.filter((id) => !citationById[id]);
		if (missing.length === 0) {
			return;
		}

		setStatus("loading-citations");

		const details = await getCitationDetails(missing);
		const mergedCitations = { ...citationById };
		details.forEach((detail) => {
			mergedCitations[detail.citationId] = detail;
		});
		set({ citationById: mergedCitations });

		setStatus("idle");
	},
}));
