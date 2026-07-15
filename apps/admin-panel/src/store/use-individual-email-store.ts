import { create } from "zustand";
import type { AllowedIndividualEmail } from "../common";
import { getAllowedIndividualEmails } from "../api/individual-email/get-allowed-individual-emails";
import { addAllowedIndividualEmail } from "../api/individual-email/add-allowed-individual-email";
import { removeAllowedIndividualEmail } from "../api/individual-email/remove-allowed-individual-email";
import { useUserErrorStore } from "./user-error-store";
import { useUserStore } from "@/store/use-user-store.ts";

interface IndividualEmailStore {
	allowedIndividualEmails: AllowedIndividualEmail[];
	getAllowedIndividualEmails: (signal: AbortSignal) => Promise<void>;
	addAllowedIndividualEmail: (email: string) => Promise<void>;
	removeAllowedIndividualEmail: (email: string) => Promise<void>;
	selectedEmail: AllowedIndividualEmail | null;
	setSelectedEmail: (email: AllowedIndividualEmail | null) => void;
	isRemoveEmailDialogOpen: boolean;
	setRemoveEmailDialogOpen: (isOpen: boolean) => void;
}

export const useIndividualEmailStore = create<IndividualEmailStore>(
	(set, get) => ({
		allowedIndividualEmails: [],

		getAllowedIndividualEmails: async (signal: AbortSignal) => {
			try {
				const allowedIndividualEmails =
					await getAllowedIndividualEmails(signal);
				set({ allowedIndividualEmails });
			} catch (error) {
				if (signal.aborted) {
					return;
				}
				console.error("Failed to fetch allowed individual emails:", error);
			}
		},

		addAllowedIndividualEmail: async (email: string) => {
			const { error } = await addAllowedIndividualEmail(email);

			if (error) {
				const isDuplicate =
					error.message ===
					'duplicate key value violates unique constraint "allowed_individual_emails_email_key"';

				if (isDuplicate) {
					useUserErrorStore.getState().handleError(new Error(error.message));
					return;
				}

				useUserErrorStore
					.getState()
					.handleError(new Error("Failed Failed to add individual email"));
				return;
			}

			await get().getAllowedIndividualEmails(new AbortController().signal);
		},

		removeAllowedIndividualEmail: async (email: string) => {
			const success = await removeAllowedIndividualEmail(email);

			const hasAccount = get().allowedIndividualEmails.some(
				(item) => item.has_account && item.email === email,
			);

			if (hasAccount) {
				await useUserStore.getState().deleteUserByEmail(email);
			}

			if (!success) {
				useUserErrorStore.getState().handleError("Failed to remove email");
				return;
			}

			await get().getAllowedIndividualEmails(new AbortController().signal);
		},

		selectedEmail: null,
		setSelectedEmail: (email: AllowedIndividualEmail | null) =>
			set({ selectedEmail: email }),

		isRemoveEmailDialogOpen: false,
		setRemoveEmailDialogOpen: (isOpen: boolean) =>
			set({ isRemoveEmailDialogOpen: isOpen }),
	}),
);
