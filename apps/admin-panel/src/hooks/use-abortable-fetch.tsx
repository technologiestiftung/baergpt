import { useEffect, useRef, useState } from "react";

type FetchResult<T> = { data: T; error: null } | { data: null; error: Error };

type Fetcher<T> = (signal: AbortSignal) => Promise<FetchResult<T>>;

interface AbortableFetchState<T> {
	data: T | null;
	isLoading: boolean;
	error: Error | null;
}

/**
 * Runs `fetcher` once `enabled` is true and aborts it on unmount or when
 * `enabled` changes. The fetcher is read from a ref, so passing an inline
 * function does not trigger refetches; only `enabled` does.
 */
export function useAbortableFetch<T>(
	fetcher: Fetcher<T>,
	enabled = true,
): AbortableFetchState<T> {
	const [state, setState] = useState<AbortableFetchState<T>>({
		data: null,
		isLoading: true,
		error: null,
	});

	const fetcherRef = useRef(fetcher);
	useEffect(() => {
		fetcherRef.current = fetcher;
	});

	useEffect(() => {
		if (!enabled) {
			return undefined;
		}

		const abortController = new AbortController();

		setState({ data: null, isLoading: true, error: null });

		fetcherRef.current(abortController.signal).then(({ data, error }) => {
			if (abortController.signal.aborted) {
				return;
			}

			if (error) {
				console.error(error);
			}

			setState({ data, isLoading: false, error });
		});

		return () => {
			abortController.abort();
		};
	}, [enabled]);

	return state;
}
