import React, { useMemo } from "react";
import { HistoryEntry } from "../history-entry.tsx";
import { useChatsStore } from "../../../../store/use-chats-store.ts";
import { subDays, format } from "date-fns";
import { de } from "date-fns/locale";
import Content from "../../../../content.ts";
import { LoadMoreChatsSpinner } from "../load-more-chats-spinner.tsx";

const today = new Date();
const sevenDaysAgo = subDays(today, 7);

export function HistoryGroupsByDate({
	historyContainerRef,
}: {
	historyContainerRef: React.RefObject<HTMLDivElement>;
}) {
	const { chats } = useChatsStore();

	const chatsToday = useMemo(
		() =>
			chats.filter(
				(chat) =>
					new Date(chat.created_at).toDateString() === today.toDateString(),
			),
		[chats, today],
	);

	const chatsLastSevenDays = useMemo(
		() =>
			chats.filter(
				(chat) =>
					new Date(chat.created_at) >= sevenDaysAgo &&
					!chatsToday.includes(chat),
			),
		[chats, sevenDaysAgo, chatsToday],
	);

	const chatsByMonth = useMemo(() => {
		const monthsMap = new Map<string, { created_at: string }[]>();

		chats
			.filter((chat) => new Date(chat.created_at) < sevenDaysAgo)
			.forEach((chat) => {
				const chatDate = new Date(chat.created_at);
				const monthLabel = format(chatDate, "MMMM yyyy", { locale: de });

				if (!monthsMap.has(monthLabel)) {
					monthsMap.set(monthLabel, []);
				}

				monthsMap.get(monthLabel)?.push(chat);
			});

		return Array.from(monthsMap.entries()).map(([month, monthChats]) => ({
			label: month,
			chats: monthChats,
		}));
	}, [chats, sevenDaysAgo]);

	const chatGroups = useMemo(() => {
		const groups = [];

		if (chatsToday.length > 0) {
			groups.push({ label: Content["chatHistory.today"], chats: chatsToday });
		}

		if (chatsLastSevenDays.length > 0) {
			groups.push({
				label: Content["chatHistory.lastSevenDays"],
				chats: chatsLastSevenDays,
			});
		}

		chatsByMonth.forEach((monthGroup) => {
			groups.push(monthGroup);
		});

		return groups;
	}, [chatsToday, chatsLastSevenDays, chatsByMonth]);

	return (
		<ul className={`w-full flex flex-col mb-5 -mt-1`}>
			{chatGroups.map(({ label, chats: chatsInGroup }) => (
				<li key={label} className="flex flex-col">
					<div className="flex items-center truncate text-xs leading-5 h-6 text-dunkelblau-40 md:px-2">
						{label}
					</div>
					<ul>
						{chatsInGroup.map((chat) => (
							<li key={chat.id}>
								<HistoryEntry key={chat.id} chat={chat} />
							</li>
						))}
					</ul>
				</li>
			))}
			<LoadMoreChatsSpinner containerRef={historyContainerRef} />
		</ul>
	);
}
