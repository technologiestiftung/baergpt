import { useEffect, useRef, useState } from "react";

const DEFAULT_MIN_DURATION_MS = 400;

/**
 * Debounces a loading boolean so that once it turns `true`, the returned
 * value stays `true` for at least `minDurationMs`, even if `isLoading` flips
 * back to `false` sooner. Prevents loading skeletons from flickering on fast
 * refetches (e.g. refresh on tab focus).
 */
export function useMinLoadingDuration(
	isLoading: boolean,
	minDurationMs: number = DEFAULT_MIN_DURATION_MS,
): boolean {
	const [isVisible, setIsVisible] = useState(isLoading);
	const startedAtRef = useRef<number | null>(isLoading ? Date.now() : null);
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		if (isLoading) {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
				timeoutRef.current = null;
			}
			startedAtRef.current = Date.now();
			setIsVisible(true);
			return undefined;
		}

		if (startedAtRef.current === null) {
			setIsVisible(false);
			return undefined;
		}

		const elapsed = Date.now() - startedAtRef.current;
		const remaining = minDurationMs - elapsed;

		if (remaining <= 0) {
			startedAtRef.current = null;
			setIsVisible(false);
			return undefined;
		}

		timeoutRef.current = setTimeout(() => {
			startedAtRef.current = null;
			setIsVisible(false);
		}, remaining);

		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
		};
	}, [isLoading, minDurationMs]);

	return isVisible;
}
