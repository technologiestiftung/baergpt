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
	const { chats, totalChatCount } = useChatsStore();
	const ref = useRef<HTMLDivElement>(null);

	const hasLoadedAllChats =
		totalChatCount !== null && chats.length >= totalChatCount;

	useIntersectionObserver({ containerRef, ref, hasLoadedAllChats });

	return (
		<div className="flex justify-center pl-2 text-hellblau-50 text-xs">
			{hasLoadedAllChats && <span>{Content["chatHistory.allLoaded"]}</span>}

			{!hasLoadedAllChats && (
				<div ref={ref} className="h-10" data-testid="load-more-chats-spinner">
					<LoadingSpinnerIcon variant="light" />
				</div>
			)}
		</div>
	);
}
