import React, { useRef, useState } from "react";
import { useChatsStore } from "../../../store/use-chats-store.ts";
import { HistoryGroupsByDate } from "./history-groups-by-date.tsx";
import { Skeleton } from "../../primitives/skeletons/skeleton.tsx";
import Content from "../../../content.ts";
import { useErrorStore } from "../../../store/error-store.ts";
import { HistoryGroupedByDropdown } from "./history-grouped-by-dropdown.tsx";
import { useHistoryGroupByStore } from "../../../store/use-history-group-by-store.ts";
import { HistoryGroupsByNone } from "./history-groups/history-groups-by-none.tsx";
import { ChevronIcon } from "../../primitives/icons/chevron-icon.tsx";

export const History: React.FC = () => {
	const { isFirstLoad, isLoading } = useChatsStore();
	const { getUIError } = useErrorStore();
	const { groupBy } = useHistoryGroupByStore();
	const [isHistoryCollapsed, setIsHistoryCollapsed] = useState<boolean>(false);
	const historyContainerRef = useRef<HTMLDivElement>(null);
	const errorMessage = getUIError("chats-fetch");

	const isGroupedByDate = groupBy === "date";

	const toggleHistoryCollapseAriaDescription = isHistoryCollapsed
		? Content["chatHistory.collapseToggle.expandChats"]
		: Content["chatHistory.collapseToggle.collapseChats"];

	const handleRetry = () => {
		const abortController = new AbortController();
		useChatsStore.getState().getChatsFromDb(abortController.signal);
	};

	return (
		<div
			className={`flex flex-col gap-[18px] w-full min-h-0 ${errorMessage ? "h-full" : ""}`}
		>
			<div className="flex justify-between">
				<h2 className="text-base leading-6 font-semibold text-hellblau-50 md:px-2 px-5 whitespace-nowrap pt-1">
					<button
						className={
							"flex items-center focus-visible:outline-default rounded-3px"
						}
						aria-expanded={!isHistoryCollapsed}
						aria-description={toggleHistoryCollapseAriaDescription}
						onClick={() => setIsHistoryCollapsed(!isHistoryCollapsed)}
					>
						{Content["chatHistory.title"]}

						<ChevronIcon
							color={"hellblau-30"}
							direction={isHistoryCollapsed ? "up" : "down"}
						/>
					</button>
				</h2>

				<HistoryGroupedByDropdown />
			</div>
			{!isHistoryCollapsed && (
				<div
					ref={historyContainerRef}
					className="flex flex-col grow min-h-0 overflow-y-auto px-5 md:px-0 md:pr-4 history-scrollbar"
				>
					<div className="w-full h-full">
						<div
							className={`w-full ${errorMessage ? "h-full overflow-hidden" : "h-fit"}`}
						>
							{isFirstLoad && (
								<div className="flex flex-col gap-1 md:px-2">
									<Skeleton className="w-full px-2 h-7" />
									<Skeleton className="w-full px-2  h-7" />
									<Skeleton className="w-full px-2  h-7" />
									<Skeleton className="w-full px-2  h-7" />
								</div>
							)}

							{!isFirstLoad && isGroupedByDate && (
								<HistoryGroupsByDate
									historyContainerRef={historyContainerRef}
								/>
							)}

							{!isFirstLoad && !isGroupedByDate && (
								<HistoryGroupsByNone
									historyContainerRef={historyContainerRef}
								/>
							)}

							{errorMessage && !isLoading && !isFirstLoad && (
								<div className="flex flex-col gap-3 text-sm leading-5 font-normal text-hellblau-30 text-center items-center justify-center h-full w-40 mx-auto">
									<p>{errorMessage}</p>
									<button
										className="flex gap-0.5 underline underline-offset-2 cursor-pointer"
										aria-label={
											Content["chatHistory.fetchRetry.button.ariaLabel"]
										}
										onClick={handleRetry}
									>
										<img
											src="/icons/refresh-white-icon.svg"
											alt=""
											className="size-6"
										/>
										{Content["chatHistory.fetchRetry.button.label"]}
									</button>
								</div>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	);
};
