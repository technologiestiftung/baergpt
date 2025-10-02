import { create } from "zustand";
import type { UserProfile, User } from "../common";
import { getUsers } from "../api/user/get-users";
import { getUser } from "../api/user/get-user";
import { getAdminStatus } from "../api/user/get-admin-status";
import { useAuthStore } from "./use-auth-store";
import {
	updateUserProfile,
	updateUserAdminStatus,
} from "../api/user/update-user";
import { deleteUser, restoreUser } from "../api/user/delete-user";
import { inviteUser } from "@/api/user/invite-user";
import { useUserErrorStore } from "./user-error-store";
import { getUserStatus } from "../components/user-table/utils/get-user-status";

interface UserStore {
	user: UserProfile | null;
	users: User[];
	selectedUser: User | null;
	isDeleteUserDialogOpen: boolean;
	isRestoreUserDialogOpen: boolean;
	isUserProfileUpdated: boolean;
	isEmailUpdateSuccessful: boolean;
	isUserAdmin: boolean;
	isAdminStatusLoaded: boolean;
	getUser: (signal: AbortSignal) => Promise<void>;
	getUsers: (signal: AbortSignal) => Promise<void>;
	checkIsUserAdmin: (signal: AbortSignal) => Promise<void>;
	setSelectedUser: (user: User | null) => void;
	setDeleteUserDialogOpen: (isOpen: boolean) => void;
	setRestoreUserDialogOpen: (isOpen: boolean) => void;
	updateUserProfile: (
		userId: string,
		profile: {
			firstName?: string;
			lastName?: string;
			academicTitle?: string;
			email?: string;
			personalTitle?: string;
		},
	) => Promise<void>;
	updateUserAdminStatus: (userId: string, isAdmin: boolean) => Promise<void>;
	deleteUser: (userId: string, hardDelete?: boolean) => Promise<void>;
	restoreUser: (userId: string) => Promise<void>;
	inviteUser: (
		email: string,
		firstName?: string,
		lastName?: string,
	) => Promise<void>;
}

export const useUserStore = create<UserStore>((set, get) => ({
	user: null,
	users: [],
	selectedUser: null,
	setSelectedUser: (user: User | null) => set({ selectedUser: user }),
	isDeleteUserDialogOpen: false,
	setDeleteUserDialogOpen: (isOpen: boolean) =>
		set({ isDeleteUserDialogOpen: isOpen }),
	isRestoreUserDialogOpen: false,
	setRestoreUserDialogOpen: (isOpen: boolean) =>
		set({ isRestoreUserDialogOpen: isOpen }),
	isUserProfileUpdated: false,
	isEmailUpdateSuccessful: false,
	isUserAdmin: false,
	isAdminStatusLoaded: false,
	checkIsUserAdmin: async (signal: AbortSignal) => {
		const isAdmin = await getAdminStatus(signal);

		/**
		 * If the admin status has not been loaded before, we need to check if the signal is still active.
		 * If the signal is aborted, we assume the admin status has not loaded yet.
		 * If the admin status has been loaded before, we can ignore the signal.
		 */
		const isAdminStatusLoaded = get().isAdminStatusLoaded || !signal.aborted;
		set({ isUserAdmin: isAdmin, isAdminStatusLoaded });
	},
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
			console.error("Failed to fetch user:", error);
			set({ user: null });
		}
	},
	getUsers: async (signal: AbortSignal) => {
		const response = await getUsers(signal);

		if (!response) {
			useUserErrorStore
				.getState()
				.handleError(new Error("Failed to fetch users."));
			return;
		}

		const { users, error } = response;

		if (error) {
			useUserErrorStore.getState().handleError(new Error(error.message));
			return;
		}

		// Extend the users with status
		const usersWithStatus = users.map((user: User) => ({
			...user,
			status: getUserStatus(user),
		}));
		set({ users: usersWithStatus });
	},
	updateUserProfile: async (
		userId: string,
		{
			firstName,
			lastName,
			academicTitle,
			email,
			personalTitle,
		}: {
			firstName?: string;
			lastName?: string;
			academicTitle?: string;
			email?: string;
			personalTitle?: string;
		},
	) => {
		try {
			await updateUserProfile(userId, {
				firstName,
				lastName,
				academicTitle,
				email,
				personalTitle,
			});
			set({ isUserProfileUpdated: true });

			if (email !== undefined) {
				set({ isEmailUpdateSuccessful: true });
				setTimeout(() => {
					set({ isEmailUpdateSuccessful: false });
				}, 3000);
			}

			setTimeout(() => {
				set({ isUserProfileUpdated: false });
			}, 3000);
		} catch (error) {
			console.error("Failed to update user first name:", error);
		}
	},
	updateUserAdminStatus: async (userId: string, isAdmin: boolean) => {
		try {
			await updateUserAdminStatus(userId, isAdmin);
			set({ isUserProfileUpdated: true });
			setTimeout(() => {
				set({ isUserProfileUpdated: false });
			}, 3000);
		} catch (error) {
			console.error("Failed to update user admin status:", error);
		}
	},
	deleteUser: async (userId: string, hardDelete = false) => {
		try {
			await deleteUser(userId, hardDelete);
		} catch (error) {
			console.error("Failed to delete user:", error);
		}
	},
	restoreUser: async (userId: string) => {
		try {
			await restoreUser(userId);
		} catch (error) {
			console.error("Failed to restore user:", error);
		}
	},
	inviteUser: async (email: string, firstName?: string, lastName?: string) => {
		try {
			await inviteUser(email, firstName, lastName);
		} catch (error) {
			if (error instanceof Error) {
				useUserErrorStore.getState().handleError(new Error(error.message));
			}
		}
	},
}));
