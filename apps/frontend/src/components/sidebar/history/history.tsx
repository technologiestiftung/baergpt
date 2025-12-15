import React, { useMemo } from "react";
import { useChatsStore } from "../../../store/use-chats-store.ts";
import { HistoryGroup } from "./history-group.tsx";
import { subDays, format } from "date-fns";
import { Skeleton } from "../../primitives/skeletons/skeleton.tsx";
import Content from "../../../content.ts";
import { de } from "date-fns/locale";
import { useErrorStore } from "../../../store/error-store.ts";

const today = new Date();
const sevenDaysAgo = subDays(today, 7);

export const History: React.FC = () => {
	const { isFirstLoad, chats, isLoading } = useChatsStore();
	const { getUIError } = useErrorStore();
	const errorMessage = getUIError("chats-fetch");

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

	const handleRetry = () => {
		const abortController = new AbortController();
		useChatsStore.getState().getChatsFromDb(abortController.signal);
	};

	return (
		<div
			className={`flex flex-col gap-[18px] w-full min-h-0 ${errorMessage ? "h-full" : ""}`}
		>
			<h2 className="text-base leading-6 font-semibold text-hellblau-50 md:px-2 px-5 whitespace-nowrap">
				{Content["chatHistory.title"]}
			</h2>
			<div className="flex flex-col grow min-h-0 overflow-y-auto px-5 md:px-0 md:pr-4 custom-scrollbar">
				<div className="w-full h-full">
					<div
						className={`w-full ${errorMessage ? "h-full overflow-hidden" : "h-fit"}`}
					>
						{isFirstLoad ||
							(isLoading && (
								<div className="flex flex-col gap-1 md:px-2">
									<Skeleton className="w-full px-2 h-7" />
									<Skeleton className="w-full px-2  h-7" />
									<Skeleton className="w-full px-2  h-7" />
									<Skeleton className="w-full px-2  h-7" />
								</div>
							))}

						{!isFirstLoad && (
							<>
								<div className={`w-full flex flex-col gap-6 mb-5 `}>
									{chatGroups.map(({ label, chats: chatGroup }) => (
										<HistoryGroup key={label} label={label} chats={chatGroup} />
									))}
								</div>
							</>
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
		</div>
	);
};
