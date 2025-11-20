import { create } from "zustand";
import { getMaintenanceModeStatus } from "../api/maintenance/get-maintenance-mode-status.ts";
import { useAuthStore } from "./auth-store.ts";

interface MaintenanceModeStore {
	checkMaintenanceMode: (signal: AbortSignal) => Promise<void>;
}

export const useMaintenanceModeStore = create<MaintenanceModeStore>(() => ({
	checkMaintenanceMode: async (signal: AbortSignal) => {
		const isMaintenanceMode = await getMaintenanceModeStatus(signal);

		// If maintenance mode is enabled, logout user
		if (isMaintenanceMode) {
			await useAuthStore.getState().logout();
		}
	},
}));
