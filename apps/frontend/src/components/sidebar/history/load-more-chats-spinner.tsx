import { type RefObject, useRef } from "react";
import { useChatsStore } from "../../../store/use-chats-store.ts";
import { LoadingSpinnerIcon } from "../../primitives/icons/loading-spinner-icon.tsx";
import Content from "../../../content.ts";
import { useIntersectionObserver } from "./hooks/use-intersection-observer.tsx";

type LoadMoreChatsSpinnerProps = {
	containerRef: RefObject<HTMLDivElement>;
};

export function LoadMoreChatsSpinner({
	containerRef,
}: LoadMoreChatsSpinnerProps) {
	const { hasMoreChats } = useChatsStore();
	const ref = useRef<HTMLDivElement>(null);

	const hasLoadedAllChats = !hasMoreChats;

	useIntersectionObserver({ containerRef, ref, hasLoadedAllChats });

	return (
		<div className="flex justify-center pl-2 text-dunkelblau-50 text-xs mt-2 pb-8">
			{hasLoadedAllChats && <span>{Content["chatHistory.allLoaded"]}</span>}

			{!hasLoadedAllChats && (
				<div ref={ref} className="h-10" data-testid="load-more-chats-spinner">
					<LoadingSpinnerIcon variant="light" />
				</div>
			)}
		</div>
	);
}
