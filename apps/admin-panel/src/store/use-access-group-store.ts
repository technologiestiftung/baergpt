import { create } from "zustand";
import { getAccessGroup } from "@/api/access-group/get-access-group";

interface AccessGroupStore {
	accessGroupId: string;
	getAccessGroupId: (signal: AbortSignal) => Promise<void>;
}

export const useAccessGroupStore = create<AccessGroupStore>((set) => ({
	accessGroupId: "",

	getAccessGroupId: async (signal: AbortSignal): Promise<void> => {
		const { id: accessGroupId } = await getAccessGroup(signal);
		set({ accessGroupId });
	},
}));
