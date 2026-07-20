import { create } from "zustand";

type InferenceLoadingStatus =
	| "idle"
	| "waiting-for-response"
	| "loading-text"
	| "loading-citations"
	| "error";

interface InferenceLoadingStatusStore {
	status: InferenceLoadingStatus;
	error?: string;
	setStatus: (status: InferenceLoadingStatus) => void;
	setError: (error: string) => void;
	clearError: () => void;
	isLoading: () => boolean;
}

export const useInferenceLoadingStatusStore =
	create<InferenceLoadingStatusStore>()((set, get) => ({
		status: "idle",
		error: undefined,
		setStatus: (status: InferenceLoadingStatus) => set({ status }),
		setError: (error: string) => set({ status: "error", error }),
		clearError: () => set({ status: "idle", error: undefined }),
		isLoading: () => {
			const { status } = get();

			return [
				"waiting-for-response",
				"loading-text",
				"loading-citations",
			].includes(status);
		},
	}));
