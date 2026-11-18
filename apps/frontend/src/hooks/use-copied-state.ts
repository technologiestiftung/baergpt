import { useEffect, useRef, useState } from "react";

const DEFAULT_COPIED_DURATION_MS = 2000;

/**
 * Tracks a transient "copied" boolean that resets itself after `durationMs`.
 * `onReset` (if given) fires both when the timer expires and on unmount with
 * a pending timer, so callers can clean up related side effects (e.g. hiding
 * a tooltip) in both cases.
 */
export function useCopiedState(
	durationMs: number = DEFAULT_COPIED_DURATION_MS,
	onReset?: () => void,
) {
	const [isCopied, setIsCopied] = useState(false);
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const triggerCopied = () => {
		setIsCopied(true);
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
		}
		timeoutRef.current = setTimeout(() => {
			setIsCopied(false);
			onReset?.();
		}, durationMs);
	};

	useEffect(() => {
		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
				onReset?.();
			}
		};
	}, []);

	return [isCopied, triggerCopied] as const;
}
