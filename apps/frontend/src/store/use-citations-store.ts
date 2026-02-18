import { create } from "zustand";
import { getCitationDetails } from "../api/citations/get-citation-details";
import { useInferenceLoadingStatusStore } from "./use-inference-loading-status-store.ts";
import type { CitationWithDetails } from "../common";

type CitationsStore = {
	citationByChunkId: Record<number, CitationWithDetails>;
	parlaCitationsById: Record<string, CitationWithDetails>;
	ensureCached: (chunkIds: number[]) => Promise<void>;
	storeParlaCitations: (parlaCitations: CitationWithDetails[]) => void;
	getCitation: (citationId: number | string) => CitationWithDetails | undefined;
};

export const useCitationsStore = create<CitationsStore>()((set, get) => ({
	citationByChunkId: {},
	parlaCitationsById: {},

	getCitation: (citationId) => {
		const state = get();

		// Check if it's a Parla citation (string ID)
		if (typeof citationId === "string") {
			return state.parlaCitationsById[citationId];
		}

		// Otherwise, it's a chunk ID from the database
		const cached = state.citationByChunkId[citationId];
		if (cached) {
			return cached;
		}
		return undefined;
	},

	storeParlaCitations(parlaCitations) {
		const { parlaCitationsById } = get();
		const merged = { ...parlaCitationsById };
		parlaCitations.forEach((citation) => {
			if (citation.id) {
				merged[citation.id] = citation;
			}
		});
		set({ parlaCitationsById: merged });
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
