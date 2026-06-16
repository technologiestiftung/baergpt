import { create } from "zustand";
import type { AllowedEmailDomain } from "../common";

// TODO: replace with api/domain/get-allowed-email-domains when implemented
async function fetchAllowedEmailDomains(
	_signal: AbortSignal,
): Promise<AllowedEmailDomain[]> {
	return [
		{
			domain: "example.com",
			date_added: new Date().toISOString(),
			added_by_user: "test@example.com",
			is_active: true,
		},
		{
			domain: "legacy.berlin.de",
			date_added: new Date().toISOString(),
			added_by_user: "admin@berlin.de",
			is_active: false,
		},
	];
}

// TODO: replace with api/domain/add-allowed-email-domain when implemented
async function createAllowedEmailDomain(_domain: string): Promise<boolean> {
	return true;
}

// TODO: replace with api/domain/deactivate-allowed-email-domain when implemented
async function deactivateAllowedEmailDomain(_domain: string): Promise<boolean> {
	return true;
}

// TODO: replace with api/domain/activate-allowed-email-domain when implemented
async function activateAllowedEmailDomain(_domain: string): Promise<boolean> {
	return true;
}

interface DomainStore {
	allowedEmailDomains: AllowedEmailDomain[];
	getAllowedEmailDomains: (signal: AbortSignal) => Promise<void>;
	addAllowedEmailDomain: (domain: string) => Promise<void>;
	deactivateAllowedEmailDomain: (domain: string) => Promise<void>;
	activateAllowedEmailDomain: (domain: string) => Promise<void>;
}

export const useDomainStore = create<DomainStore>((set, get) => ({
	allowedEmailDomains: [],
	getAllowedEmailDomains: async (signal: AbortSignal) => {
		const allowedEmailDomains = await fetchAllowedEmailDomains(signal);
		set({ allowedEmailDomains });
	},
	addAllowedEmailDomain: async (domain: string) => {
		const normalizedDomain = domain.toLowerCase();
		await createAllowedEmailDomain(normalizedDomain);
	},
	deactivateAllowedEmailDomain: async (domain: string) => {
		const response = await deactivateAllowedEmailDomain(domain);
		if (response) {
			set({
				allowedEmailDomains: get().allowedEmailDomains.map((entry) =>
					entry.domain === domain ? { ...entry, is_active: false } : entry,
				),
			});
		}
	},
	activateAllowedEmailDomain: async (domain: string) => {
		const response = await activateAllowedEmailDomain(domain);
		if (response) {
			set({
				allowedEmailDomains: get().allowedEmailDomains.map((entry) =>
					entry.domain === domain ? { ...entry, is_active: true } : entry,
				),
			});
		}
	},
}));
