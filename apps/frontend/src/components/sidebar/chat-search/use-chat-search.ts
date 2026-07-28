import { useCallback, useEffect, useRef, useState } from "react";
import {
	searchChats,
	type ChatSearchResult,
} from "../../../api/chat/search-chats";

const SEARCH_DEBOUNCE_MS = 250;

export function useChatSearch() {
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<ChatSearchResult[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [selectedIndex, setSelectedIndex] = useState(0);

	const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
	const abortControllerRef = useRef<AbortController | null>(null);

	const reset = useCallback(() => {
		clearTimeout(debounceTimeoutRef.current);
		abortControllerRef.current?.abort();
		abortControllerRef.current = null;
		setQuery("");
		setResults([]);
		setIsLoading(false);
		setSelectedIndex(0);
	}, []);

	useEffect(() => {
		clearTimeout(debounceTimeoutRef.current);
		abortControllerRef.current?.abort();

		const trimmedQuery = query.trim();
		if (!trimmedQuery) {
			setResults([]);
			setIsLoading(false);
			setSelectedIndex(0);
			return () => {};
		}

		setIsLoading(true);

		debounceTimeoutRef.current = setTimeout(async (): Promise<void> => {
			const abortController = new AbortController();
			abortControllerRef.current = abortController;

			const searchResults = await searchChats(
				trimmedQuery,
				abortController.signal,
			);

			if (abortController.signal.aborted) {
				return;
			}

			setResults(searchResults);
			setSelectedIndex(0);
			setIsLoading(false);
		}, SEARCH_DEBOUNCE_MS);

		return () => {
			clearTimeout(debounceTimeoutRef.current);
			abortControllerRef.current?.abort();
		};
	}, [query]);

	const moveSelection = useCallback(
		(direction: "up" | "down", itemCount: number) => {
			if (itemCount === 0) {
				return;
			}

			setSelectedIndex((currentIndex) => {
				if (direction === "down") {
					return Math.min(currentIndex + 1, itemCount - 1);
				}
				return Math.max(currentIndex - 1, 0);
			});
		},
		[],
	);

	return {
		query,
		setQuery,
		results,
		isLoading,
		selectedIndex,
		setSelectedIndex,
		moveSelection,
		reset,
		hasQuery: query.trim().length > 0,
	};
}
