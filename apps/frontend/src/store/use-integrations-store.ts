import { create } from "zustand";
import {
	getIntegrations,
	type Integration,
	type IntegrationProvider,
} from "../api/integrations/get-integrations.ts";

interface IntegrationsStore {
	integrations: Integration[] | null;
	hasIntegration(provider: IntegrationProvider): boolean;
	getIntegration(provider: IntegrationProvider): Integration | undefined;
	fetchIntegrations(): Promise<void>;
	upsertIntegration(integration: Integration): void;
	removeIntegration(provider: IntegrationProvider): void;
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
		const integrations = await getIntegrations();
		if (integrations) {
			set({ integrations });
		}
	},

	upsertIntegration(integration) {
		const others = (get().integrations ?? []).filter(
			(i) => i.provider !== integration.provider,
		);
		set({ integrations: [...others, integration] });
	},

	removeIntegration(provider) {
		const existing = get().integrations ?? [];
		set({ integrations: existing.filter((i) => i.provider !== provider) });
	},
}));
