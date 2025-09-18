import { create } from "zustand";

type InferenceLoadingStatus =
	| "idle"
	| "waiting-for-response"
	| "loading-text"
	| "loading-citations";

interface InferenceLoadingStatusStore {
	status: InferenceLoadingStatus;
	setStatus: (status: InferenceLoadingStatus) => void;
}

export const useInferenceLoadingStatusStore =
	create<InferenceLoadingStatusStore>()((set) => ({
		status: "idle",
		setStatus: (status: InferenceLoadingStatus) => set({ status }),
	}));
