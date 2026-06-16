import { create } from "zustand";
import type { AllowedEmailDomain } from "../common";

// TODO: replace with api/domain/get-allowed-email-domains when implemented
async function fetchAllowedEmailDomains(
	_signal: AbortSignal,
): Promise<AllowedEmailDomain[]> {
	return [
		{
			domain: "example.com",
			is_active: true,
			created_at: new Date().toISOString(),
			created_by: "test@example.com",
			last_status_change_at: null,
			last_status_change_by: null,
			user_count: 0,
		},
		{
			domain: "legacy.berlin.de",
			is_active: false,
			created_at: new Date().toISOString(),
			created_by: "admin@berlin.de",
			last_status_change_at: new Date().toISOString(),
			last_status_change_by: "admin@berlin.de",
			user_count: 3,
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
	selectedDomain: AllowedEmailDomain | null;
	setSelectedDomain: (domain: AllowedEmailDomain | null) => void;
	isChangeDomainStatusDialogOpen: boolean;
	setChangeDomainStatusDialogOpen: (isOpen: boolean) => void;
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
	selectedDomain: null,
	setSelectedDomain: (domain: AllowedEmailDomain | null) =>
		set({ selectedDomain: domain }),
	isChangeDomainStatusDialogOpen: false,
	setChangeDomainStatusDialogOpen: (isOpen: boolean) =>
		set({ isChangeDomainStatusDialogOpen: isOpen }),
}));
