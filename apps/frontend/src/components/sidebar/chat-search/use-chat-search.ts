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
	const [isKeyboardSelection, setIsKeyboardSelection] = useState(false);

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
		setIsKeyboardSelection(false);
	}, []);

	useEffect(() => {
		clearTimeout(debounceTimeoutRef.current);
		abortControllerRef.current?.abort();

		const trimmedQuery = query.trim();
		if (!trimmedQuery) {
			setResults([]);
			setIsLoading(false);
			setSelectedIndex(0);
			setIsKeyboardSelection(false);
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
			setIsKeyboardSelection(false);
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

			setIsKeyboardSelection(true);
			setSelectedIndex((currentIndex) => {
				if (direction === "down") {
					return Math.min(currentIndex + 1, itemCount - 1);
				}
				return Math.max(currentIndex - 1, 0);
			});
		},
		[],
	);

	const selectIndex = useCallback((index: number) => {
		setIsKeyboardSelection(false);
		setSelectedIndex(index);
	}, []);

	return {
		query,
		setQuery,
		results,
		isLoading,
		selectedIndex,
		selectIndex,
		isKeyboardSelection,
		moveSelection,
		reset,
		hasQuery: query.trim().length > 0,
	};
}
