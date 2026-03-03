import { create } from "zustand";
import { getCitationDetails } from "../api/citations/get-citation-details";
import { useInferenceLoadingStatusStore } from "./use-inference-loading-status-store.ts";
import type { CitationWithDetails } from "../common";

type CitationsStore = {
	citationsByRowId: Record<number, CitationWithDetails[]>;
	ensureCached: (citationIds: number[]) => Promise<void>;
	getCitations: (citationId: number) => CitationWithDetails[];
};

export const useCitationsStore = create<CitationsStore>()((set, get) => ({
	citationsByRowId: {},

	getCitations: (citationId) => {
		return get().citationsByRowId[citationId] || [];
	},

	async ensureCached(citationIds) {
		const { citationsByRowId } = get();
		const { setStatus } = useInferenceLoadingStatusStore.getState();

		const unique = Array.from(new Set(citationIds));
		const missing = unique.filter((id) => !citationsByRowId[id]);
		if (missing.length === 0) {
			return;
		}

		setStatus("loading-citations");

		const details = await getCitationDetails(missing);
		const mergedCitations = { ...citationsByRowId };

		// Group citation details by citation_id (row ID)
		details.forEach((detail) => {
			if (!mergedCitations[detail.citationId]) {
				mergedCitations[detail.citationId] = [];
			}
			mergedCitations[detail.citationId].push(detail);
		});

		set({ citationsByRowId: mergedCitations });

		setStatus("idle");
	},
}));
