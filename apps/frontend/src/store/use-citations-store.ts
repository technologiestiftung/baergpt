import { create } from "zustand";
import { getCitationDetails } from "../api/citations/get-citation-details";
import { useInferenceLoadingStatusStore } from "./use-inference-loading-status-store.ts";
import type { CitationWithDetails } from "../common";

type CitationsStore = {
	citationByChunkId: Record<number, CitationWithDetails>;
	ensureCached: (chunkIds: number[]) => Promise<void>;
	getCitation: (chunkId: number) => CitationWithDetails | undefined;
};

export const useCitationsStore = create<CitationsStore>()((set, get) => ({
	citationByChunkId: {},
	getCitation: (chunkId) => {
		const state = get();
		const cached = state.citationByChunkId[chunkId];
		if (cached) {
			return cached;
		}
		return undefined;
	},

	async ensureCached(chunkIds) {
		const { citationByChunkId } = get();
		const { setStatus } = useInferenceLoadingStatusStore.getState();

		const unique = Array.from(new Set(chunkIds));
		const missing = unique.filter((id) => !citationByChunkId[id]);
		if (missing.length === 0) {
			return;
		}

		setStatus("loading-citations");
		const details = await getCitationDetails(missing);
		const merged = { ...citationByChunkId };
		details.forEach((detail) => {
			merged[detail.chunkId] = detail;
		});
		set({ citationByChunkId: merged });
		setStatus("idle");
	},
}));
