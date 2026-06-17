import { create } from "zustand";
import type { AllowedEmailDomain } from "../common";
import { getAllowedEmailDomains } from "../api/domain/get-allowed-email-domains";
import { addAllowedEmailDomain } from "../api/domain/add-allowed-email-domain";
import { deactivateAllowedEmailDomain } from "../api/domain/deactivate-allowed-email-domain";
import { activateAllowedEmailDomain } from "../api/domain/activate-allowed-email-domain";

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
		const allowedEmailDomains = await getAllowedEmailDomains(signal);
		set({ allowedEmailDomains });
	},
	addAllowedEmailDomain: async (domain: string) => {
		await addAllowedEmailDomain(domain.toLowerCase());
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
