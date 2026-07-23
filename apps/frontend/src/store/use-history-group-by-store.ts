import { create } from "zustand";
import { persist } from "zustand/middleware";

const STORAGE_KEY = "history-group-by";

export type GroupingOption = "none" | "date";

interface HistoryGroupByStore {
	groupBy: GroupingOption;
	setGroupBy: (groupBy: GroupingOption) => void;
}

export const useHistoryGroupByStore = create<HistoryGroupByStore>()(
	persist(
		(set) => ({
			groupBy: "none",

			setGroupBy: (groupBy: GroupingOption) => set({ groupBy }),
		}),
		{ name: STORAGE_KEY },
	),
);
