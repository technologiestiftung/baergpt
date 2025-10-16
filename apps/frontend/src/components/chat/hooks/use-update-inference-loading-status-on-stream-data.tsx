import { useEffect } from "react";
import type { DeepPartial } from "ai";
import type { StreamedObject } from "../../../schemas/streamed-object-schema.ts";
import { useInferenceLoadingStatusStore } from "../../../store/use-inference-loading-status-store.ts";

export function useUpdateInferenceLoadingStatusOnStreamData(
	streamedObject: DeepPartial<StreamedObject> | undefined,
) {
	const { status, setStatus } = useInferenceLoadingStatusStore();

	useEffect(() => {
		if (!streamedObject || !streamedObject.content) {
			return;
		}

		if (
			typeof streamedObject.content === "string" &&
			streamedObject.content.length > 0 &&
			status !== "loading-text"
		) {
			setStatus("loading-text");
		}
	}, [streamedObject?.content]);

	useEffect(() => {
		if (!streamedObject || !streamedObject.citations) {
			return;
		}

		if (
			Array.isArray(streamedObject.citations) &&
			streamedObject.citations.length > 0 &&
			status !== "loading-citations"
		) {
			setStatus("loading-citations");
		}
	}, [streamedObject?.citations]);
}
