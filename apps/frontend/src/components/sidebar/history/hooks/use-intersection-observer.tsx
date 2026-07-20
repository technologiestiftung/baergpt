import { type RefObject, useEffect } from "react";
import { useChatsStore } from "../../../../store/use-chats-store.ts";

type UseIntersectionObserverArgs = {
	containerRef: RefObject<HTMLDivElement>;
	ref: RefObject<HTMLDivElement>;
	hasLoadedAllChats: boolean;
};

export function useIntersectionObserver({
	containerRef,
	ref,
	hasLoadedAllChats,
}: UseIntersectionObserverArgs) {
	useEffect(() => {
		const spinnerElement = ref.current;
		const containerElement = containerRef.current;

		if (!spinnerElement || !containerElement || hasLoadedAllChats) {
			return () => {};
		}

		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (!entry.isIntersecting) {
						return;
					}

					useChatsStore.getState().getNextChatsPage();
				});
			},
			{
				root: containerElement,
				threshold: 0.1,
			},
		);

		observer.observe(spinnerElement);

		return () => observer.disconnect();
	}, [containerRef, ref, hasLoadedAllChats]);
}
