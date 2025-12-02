import { create } from "zustand";
import type { Session, AuthChangeEvent } from "@supabase/supabase-js";
import { supabase } from "../../supabase-client.ts";
import { useAuthErrorStore } from "./auth-error-store.ts";
import { handleSessionChange } from "../api/session/handle-session-change.ts";
import { updatePassword } from "../api/auth/update-password.ts";
import { resetPasswordForEmail } from "../api/auth/reset-password-for-email.ts";
import { getAdminStatus } from "../api/user/get-admin-status.ts";
import { useIsActiveStore } from "./use-is-active-store.ts";
import { updateEmail } from "../api/auth/update-email.ts";
import { captureError } from "../monitoring/capture-error.ts";
import { getAllowedEmailDomains } from "../api/auth/get-allowed-email-domains.ts";

let resendTime: number | null = null;

type EmailConfirmationStatus = "unknown" | "confirmed" | "unconfirmed";

interface AuthStore {
	isInitialized: boolean;
	unconfirmedEmail: string | null;
	emailConfirmationStatus: EmailConfirmationStatus;
	session: Session | null | undefined;
	isPasswordResetEmailSent: boolean;
	passwordResetEmail: string | null;
	isPasswordResetSuccessful: boolean;
	isPasswordRecoveryMode: boolean;
	isUserAdmin: boolean;
	isAdminStatusLoaded: boolean;
	allowedEmailDomains?: string[];
	register: (args: {
		firstName: string;
		lastName: string;
		email: string;
		password: string;
	}) => Promise<void>;
	updateEmail: (newEmail: string) => Promise<{ error: Error | null }>;
	updatePassword: (newPassword: string) => Promise<void>;
	resendConfirmationEmail: () => Promise<void>;
	requestPasswordReset: (email: string) => Promise<void>;
	resetPassword: (newPassword: string) => Promise<void>;
	login: (args: { email: string; password: string }) => Promise<void>;
	logout: () => Promise<void>;
	checkIsUserAdmin: (signal: AbortSignal) => Promise<void>;
	getAllowedEmailDomains: (signal: AbortSignal) => Promise<void>;
}

export const useAuthStore = create<AuthStore>()((set, get) => {
	let isStoreInitialized = false;

	// Subscribe to auth state changes
	supabase.auth.onAuthStateChange(
		(event: AuthChangeEvent, sessionChange: Session | null) => {
			const currentState = get();

			if (event === "PASSWORD_RECOVERY") {
				set({ isPasswordRecoveryMode: true });
			}

			const isConfirmed = !!sessionChange?.user?.email_confirmed_at;
			let newEmailConfirmationStatus: AuthStore["emailConfirmationStatus"] =
				"unknown";
			let newUnconfirmedEmail: string | null = null;

			if (sessionChange) {
				if (isConfirmed) {
					newEmailConfirmationStatus = "confirmed";
					newUnconfirmedEmail = null;
				} else {
					newEmailConfirmationStatus = "unconfirmed";
					newUnconfirmedEmail =
						sessionChange.user.email ?? currentState.unconfirmedEmail;
				}
			} else if (event === "SIGNED_OUT") {
				newEmailConfirmationStatus = "unknown";
				newUnconfirmedEmail = null;
			} else if (
				currentState.emailConfirmationStatus === "unconfirmed" &&
				currentState.unconfirmedEmail
			) {
				newEmailConfirmationStatus = "unconfirmed";
				newUnconfirmedEmail = currentState.unconfirmedEmail;
			} else {
				newEmailConfirmationStatus = "unknown";
				newUnconfirmedEmail = null;
			}

			const newState: Partial<AuthStore> = {
				unconfirmedEmail: newUnconfirmedEmail,
				emailConfirmationStatus: newEmailConfirmationStatus,
				session: sessionChange,
				isInitialized: true,
			};
			set(newState);
			isStoreInitialized = true;

			// Call handler only if session object identity changes
			if (currentState.session !== sessionChange) {
				handleSessionChange(sessionChange);
			}
		},
	);

	/**
	 * During initialization of the store,
	 * check if the user is already logged in.
	 */
	supabase.auth.getSession().then(({ data }) => {
		if (!isStoreInitialized) {
			// Only set initial state if onAuthStateChange hasn't run yet
			const initialSession = data?.session ?? null;
			const isConfirmed = !!initialSession?.user?.email_confirmed_at;
			let initialStatus: AuthStore["emailConfirmationStatus"] = "unknown";
			if (initialSession) {
				initialStatus = isConfirmed ? "confirmed" : "unconfirmed";
			}
			const initialUnconfirmedEmail =
				initialSession && !isConfirmed ? initialSession.user.email : null;

			const initialState: Partial<AuthStore> = {
				session: initialSession,
				emailConfirmationStatus: initialStatus,
				unconfirmedEmail: initialUnconfirmedEmail,
				isInitialized: true,
			};
			set(initialState);
			isStoreInitialized = true;

			if (initialSession) {
				handleSessionChange(initialSession);
			}
		}
	});

	return {
		unconfirmedEmail: null,
		emailConfirmationStatus: "unknown" as EmailConfirmationStatus,
		session: undefined,
		isInitialized: false,
		isPasswordResetEmailSent: false,
		passwordResetEmail: null,
		isPasswordResetSuccessful: false,
		isPasswordRecoveryMode: false,
		isUserAdmin: false,
		isAdminStatusLoaded: false,

		async register({ firstName, lastName, email, password }) {
			const { data, error } = await supabase.auth.signUp({
				email,
				password,
				options: {
					data: { first_name: firstName, last_name: lastName },
				},
			});

			if (error) {
				useAuthErrorStore.getState().handleError(new Error(error.message));
				return;
			}

			if (data.user && !data.user.email_confirmed_at) {
				// Explicitly set the unconfirmed email here in addition to relying on onAuthStateChange
				// This helps if there's any delay in the event firing.
				set({
					unconfirmedEmail: email,
					emailConfirmationStatus: "unconfirmed",
				});
			}
		},
		async updatePassword(newPassword) {
			try {
				await updatePassword(newPassword);
			} catch (error) {
				useAuthErrorStore
					.getState()
					.handleError(
						error instanceof Error
							? error
							: new Error("Password update failed"),
					);
			}
		},

		async updateEmail(newEmail: string) {
			const { error } = await updateEmail(newEmail);
			return { error };
		},

		resendConfirmationEmail: async () => {
			const { unconfirmedEmail } = get();
			if (!unconfirmedEmail) {
				useAuthErrorStore
					.getState()
					.handleError(new Error("No unconfirmed email set"));
				return;
			}
			/**
			 * If the user has already re-sent a confirmation email,
			 * Wait for 60 seconds before allowing them to do it again.
			 */
			const isAllowedToResend =
				resendTime === null || Date.now() - resendTime > 60_000;
			if (!isAllowedToResend) {
				return;
			}
			resendTime = Date.now();
			const { error } = await supabase.auth.resend({
				type: "signup",
				email: unconfirmedEmail,
			});
			if (error) {
				useAuthErrorStore.getState().handleError(new Error(error.message));
			}
		},

		// sends mail to user with reset password link
		async requestPasswordReset(email: string) {
			await resetPasswordForEmail(
				email,
				import.meta.env.VITE_RECOVERY_AUTH_REDIRECT_URL,
			);

			set({
				isPasswordResetEmailSent: true,
				passwordResetEmail: email,
			});
		},

		// sets a new password for the user and is triggered by reset password link from mail
		async resetPassword(newPassword: string) {
			const { error } = await updatePassword(newPassword);

			if (error) {
				throw error;
			}

			set({ isPasswordResetSuccessful: true });
		},

		async login({ email, password }) {
			const { error } = await supabase.auth.signInWithPassword({
				email,
				password,
			});

			if (error) {
				console.error("Login error:", error);

				if (error.message === "Email not confirmed") {
					set({
						unconfirmedEmail: email,
						emailConfirmationStatus: "unconfirmed",
					});
					return;
				}

				useAuthErrorStore.getState().handleError(new Error(error.message));
				return;
			}
		},

		async logout() {
			await supabase.auth.signOut();
			set({
				session: null,
				unconfirmedEmail: null,
				emailConfirmationStatus: "unknown",
				isInitialized: true,
				isUserAdmin: false,
				isAdminStatusLoaded: false,
			});
			/**
			 * Reset the isActive state when logging out,
			 * so that a new login starts with a fresh state,
			 * and not with the previous user's active state.
			 */
			useIsActiveStore.getState().resetIsActive();

			/**
			 * In the past, sometimes the session was not destroyed properly.
			 * So we double-check and log an error if the session still exists,
			 * so we can try to investigate further when/if it happens again.
			 */
			const { data, error } = await supabase.auth.getSession();

			if (error) {
				captureError(error);
				return;
			}

			if (data?.session) {
				captureError(new Error("Session was not destroyed after logout."));
			}
		},

		async checkIsUserAdmin(signal: AbortSignal) {
			const isAdmin = await getAdminStatus(signal);

			/**
			 * If the admin status has not been loaded before, we need to check if the signal is still active.
			 * If the signal is aborted, we assume the admin status has not loaded yet.
			 * If the admin status has been loaded before, we can ignore the signal.
			 */
			const isAdminStatusLoaded = get().isAdminStatusLoaded || !signal.aborted;

			set({ isUserAdmin: isAdmin, isAdminStatusLoaded });
		},

		async getAllowedEmailDomains(signal: AbortSignal) {
			const allowedEmailDomains = await getAllowedEmailDomains(signal);
			set({ allowedEmailDomains });
		},
	};
});
