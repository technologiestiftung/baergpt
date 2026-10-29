import { create } from "zustand";
import {
	getIntegrations,
	type Integration,
	type IntegrationProvider,
} from "../api/integrations/get-integrations.ts";
import { useAuthStore } from "./auth-store.ts";

let generation = 0;

interface IntegrationsStore {
	integrations: Integration[] | null;
	hasIntegration(provider: IntegrationProvider): boolean;
	getIntegration(provider: IntegrationProvider): Integration | undefined;
	fetchIntegrations(): Promise<void>;
	upsertIntegration(integration: Integration): void;
	removeIntegration(provider: IntegrationProvider): void;
	reset(): void;
}

export const useIntegrationsStore = create<IntegrationsStore>()((set, get) => ({
	integrations: null,

	hasIntegration(provider) {
		return get().integrations?.some((i) => i.provider === provider) ?? false;
	},

	getIntegration(provider) {
		return get().integrations?.find((i) => i.provider === provider);
	},

	async fetchIntegrations() {
		const generationAtFetch = generation;
		const userIdAtFetch = useAuthStore.getState().session?.user.id;
		const integrations = await getIntegrations();
		const isStale =
			generation !== generationAtFetch ||
			useAuthStore.getState().session?.user.id !== userIdAtFetch;
		if (integrations && !isStale) {
			set({ integrations });
		}
	},

	upsertIntegration(integration) {
		const others = (get().integrations ?? []).filter(
			(i) => i.provider !== integration.provider,
		);
		generation += 1;
		set({ integrations: [...others, integration] });
	},

	removeIntegration(provider) {
		const existing = get().integrations ?? [];
		generation += 1;
		set({ integrations: existing.filter((i) => i.provider !== provider) });
	},

	reset() {
		generation += 1;
		set({ integrations: null });
	},
}));
