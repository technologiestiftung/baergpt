import { create } from "zustand";
import { getCitationDetails } from "../api/citations/get-citation-details";
import { useInferenceLoadingStatusStore } from "./use-inference-loading-status-store.ts";
import type { CitationWithDetails } from "../common";

type CitationsStore = {
	citationByChunkId: Record<number, CitationWithDetails | null | undefined>;
};

let debounceTimeout: ReturnType<typeof setTimeout> | undefined = undefined;
const queue: Set<number> = new Set();

export const useCitationsStore = create<CitationsStore>()(() => ({
	citationByChunkId: {},
}));

export function addChunkIdsToCache(chunkIds: number[]) {
	chunkIds.forEach((chunkId) => addChunkIdToCache(chunkId));
}

export function addChunkIdToCache(chunkId: number) {
	const { citationByChunkId } = useCitationsStore.getState();

	const isCached =
		citationByChunkId[chunkId] !== undefined || queue.has(chunkId);

	if (isCached) {
		return;
	}

	queue.add(chunkId);

	clearTimeout(debounceTimeout);

	debounceTimeout = setTimeout(async () => {
		await loadCitations();
		queue.clear();
	}, 300);
}

async function loadCitations() {
	const chunkIds = Array.from(queue);

	const { setStatus } = useInferenceLoadingStatusStore.getState();
	setStatus("loading-citations");

	const details = await getCitationDetails(chunkIds);
	const merged = { ...useCitationsStore.getState().citationByChunkId };
	details.forEach((detail) => {
		merged[detail.chunkId] = detail;
	});
	useCitationsStore.setState({ citationByChunkId: merged });

	setStatus("idle");
}
