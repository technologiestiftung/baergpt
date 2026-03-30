import { create } from "zustand";
import type { User } from "../common";
import { getUser } from "../api/user/get-user";
import { useAuthStore } from "./auth-store";
import { deleteUser } from "../api/auth/delete-user.ts";
import { updateProfilesTable } from "../api/auth/update-profiles-table.ts";
import { updateUserMetadata } from "../api/auth/update-user-metadata.ts";
import { useErrorStore } from "./error-store.ts";
import { updateAddressedFormal } from "../api/user/update-addressed-formal.ts";

interface UserStore {
	user: User | null;
	getUser: (signal: AbortSignal) => Promise<void>;
	updateUser: (args: {
		first_name: string;
		last_name: string;
		academic_title: string;
		personal_title: string;
	}) => Promise<void>;
	deleteAccount: () => Promise<{ error: Error | null }>;
	updateAddressedFormal: (isAddressedFormal: boolean) => Promise<void>;
}

export const useUserStore = create<UserStore>((set, get) => ({
	user: null,
	getUser: async (signal: AbortSignal) => {
		const userId = useAuthStore.getState().session?.user.id;
		if (!userId) {
			console.error("User ID is undefined. Cannot fetch user.");
			set({ user: null });
			return;
		}
		try {
			const user = await getUser(userId, signal);
			set({ user });
		} catch (error) {
			useErrorStore.getState().handleError(error);
			set({ user: null });
		}
	},

	async updateUser({ first_name, last_name, academic_title, personal_title }) {
		try {
			// Update user metadata
			await updateUserMetadata(first_name, last_name);

			// Update user profile in database
			await updateProfilesTable({
				first_name,
				last_name,
				academic_title,
				personal_title,
			});

			await get().getUser(new AbortController().signal);
		} catch (error) {
			useErrorStore
				.getState()
				.handleError(
					error instanceof Error ? error : new Error("User update failed"),
				);
		}
	},

	async updateAddressedFormal(isAddressedFormal: boolean) {
		const { error } = await updateAddressedFormal(isAddressedFormal);

		if (error) {
			useErrorStore.getState().handleError(error);
			return;
		}

		await get().getUser(new AbortController().signal);
	},

	deleteAccount: async () => {
		const session = useAuthStore.getState().session;
		if (!session) {
			const error = new Error("account_deletion_failed");
			useErrorStore.getState().handleError(error);
			return { error };
		}
		const { error } = await deleteUser();
		if (error) {
			useErrorStore.getState().handleError(error);
			return { error };
		}
		// Clear user data
		set({ user: null });
		// Clear session
		await useAuthStore.getState().logout();
		return { error: null };
	},
}));
