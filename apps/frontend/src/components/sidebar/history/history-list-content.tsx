import React from "react";
import { HistoryGroupsByDate } from "./history-groups/history-groups-by-date.tsx";
import { Skeleton } from "../../primitives/skeletons/skeleton.tsx";
import { HistoryGroupsByNone } from "./history-groups/history-groups-by-none.tsx";
import Content from "../../../content.ts";
import { useChatsStore } from "../../../store/use-chats-store.ts";
import { useHistoryGroupByStore } from "../../../store/use-history-group-by-store.ts";

export const HistoryListContent: React.FC<{
	isFirstLoad: boolean;
	hasError: boolean;
	historyContainerRef: React.RefObject<HTMLDivElement | null>;
}> = ({ isFirstLoad, hasError, historyContainerRef }) => {
	const hasChats = useChatsStore((state) => state.chats.length >= 1);
	const hasMoreChats = useChatsStore((state) => state.hasMoreChats);
	const isHistoryEmpty = !hasChats && !hasMoreChats;

	const { groupBy } = useHistoryGroupByStore();
	const isGroupedByDate = groupBy === "date";

	if (isFirstLoad) {
		return (
			<div className="flex flex-col gap-1 md:px-2">
				<Skeleton className="w-full px-2 h-7" />
				<Skeleton className="w-full px-2  h-7" />
				<Skeleton className="w-full px-2  h-7" />
				<Skeleton className="w-full px-2  h-7" />
			</div>
		);
	}

	if (!hasError && isHistoryEmpty) {
		return (
			<p className="overflow-hidden text-ellipsis pl-2 text-xs leading-4 font-normal text-dunkelblau-50 lining-nums proportional-nums">
				{Content["chatHistory.emptyState.title"]}
			</p>
		);
	}

	if (isHistoryEmpty) {
		return null;
	}

	return isGroupedByDate ? (
		<HistoryGroupsByDate historyContainerRef={historyContainerRef} />
	) : (
		<HistoryGroupsByNone historyContainerRef={historyContainerRef} />
	);
};
