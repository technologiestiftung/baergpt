import { create } from "zustand";
import type { Session, AuthChangeEvent } from "@supabase/supabase-js";
import { supabase } from "../../supabase-client.ts";
import { useAuthErrorStore } from "./use-auth-error-store.ts";
import { handleSessionChange } from "../api/session/handle-session-change.ts";
import { useUserStore } from "./use-user-store.ts";

let resendTime: number | null = null;

type EmailConfirmationStatus = "unknown" | "confirmed" | "unconfirmed";

interface AuthStore {
	isInitialized: boolean;
	unconfirmedEmail: string | null;
	emailConfirmationStatus: EmailConfirmationStatus;
	session: Session | null | undefined;
	resendConfirmationEmail: () => Promise<void>;
	login: (args: { email: string; password: string }) => Promise<void>;
	logout: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>()((set, get) => {
	let isStoreInitialized = false;

	supabase.auth.onAuthStateChange(
		(event: AuthChangeEvent, sessionChange: Session | null) => {
			const currentState = get();

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
		isEmailUpdateSuccessful: false,

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

		async login({ email, password }) {
			const { data, error } = await supabase.auth.signInWithPassword({
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

			// Check if the user account is deactivated
			const userId = data?.user?.id;
			if (userId) {
				await useUserStore.getState().getUser(new AbortController().signal);
				if (useUserStore.getState().user?.deleted_at) {
					await supabase.auth.signOut(); // Force logout
					useAuthErrorStore
						.getState()
						.handleError(new Error("User account has been deactivated."));
					return;
				}
			}

			// Check if user is an admin
			await useUserStore
				.getState()
				.checkIsUserAdmin(new AbortController().signal);
			const isAdmin = useUserStore.getState().isUserAdmin;
			if (!isAdmin) {
				await supabase.auth.signOut(); // Force logout
				useAuthErrorStore
					.getState()
					.handleError(new Error("Access denied. Admin privileges required."));
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
			});
		},
	};
});
