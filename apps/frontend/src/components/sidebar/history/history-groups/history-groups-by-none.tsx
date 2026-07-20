import React from "react";
import { useChatsStore } from "../../../../store/use-chats-store.ts";
import { LoadMoreChatsSpinner } from "../load-more-chats-spinner.tsx";
import { HistoryEntry } from "../history-entry.tsx";

export function HistoryGroupsByNone({
	historyContainerRef,
}: {
	historyContainerRef: React.RefObject<HTMLDivElement>;
}) {
	const { chats } = useChatsStore();

	return (
		<>
			<ul className="mb-5">
				{chats.map((chat) => (
					<li key={chat.id}>
						<HistoryEntry chat={chat} />
					</li>
				))}
			</ul>
			<LoadMoreChatsSpinner containerRef={historyContainerRef} />
		</>
	);
}
