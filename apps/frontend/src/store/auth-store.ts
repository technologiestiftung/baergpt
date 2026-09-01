import { create } from "zustand";
import type { Session, AuthChangeEvent } from "@supabase/supabase-js";
import { supabase } from "../../supabase-client.ts";
import { useAuthErrorStore } from "./auth-error-store.ts";
import { handleSessionChange } from "../api/session/handle-session-change.ts";
import { getAdminStatus } from "../api/user/get-admin-status.ts";
import { updateEmail } from "../api/auth/update-email.ts";
import { captureError } from "../monitoring/capture-error.ts";
import { resendOtpEmail } from "../api/auth/resend-otp-email.ts";
import type { Span } from "@sentry/react";
import { getIsUserBanned } from "../api/auth/get-is-user-banned.ts";

let resendTime: number | null = null;

type EmailConfirmationStatus = "unknown" | "confirmed" | "unconfirmed";

interface AuthStore {
	isInitialized: boolean;
	unconfirmedEmail: string | null;
	emailConfirmationStatus: EmailConfirmationStatus;
	session: Session | null | undefined;
	isUserAdmin: boolean;
	isAdminStatusLoaded: boolean;
	isBanned: boolean | null;
	register: (args: {
		firstName: string;
		lastName: string;
		email: string;
		span: Span;
	}) => Promise<{ error: Error | null }>;
	updateEmail: (newEmail: string) => Promise<{ error: Error | null }>;
	resendConfirmationEmail: () => Promise<void>;
	resetUnconfirmedEmail: () => void;
	resendOtpEmail: (args: {
		email: string;
		otpType: "email" | "email_change";
	}) => Promise<void>;
	requestLoginOtp: (args: {
		email: string;
		span: Span;
	}) => Promise<{ error: Error | null }>;
	logout: () => Promise<void>;
	checkIsUserAdmin: (signal: AbortSignal) => Promise<void>;
	checkIsUserBanned: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>()((set, get) => {
	let isStoreInitialized = false;

	// Subscribe to auth state changes
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
		isUserAdmin: false,
		isAdminStatusLoaded: false,
		isBanned: null,

		async register({ firstName, lastName, email, span }) {
			/**
			 * Passwordless sign-up: GoTrue sends a one-time code and creates the
			 * account (with the name metadata) only if the email doesn't exist yet.
			 * The response is generic whether or not the email already exists, which
			 * preserves anti-enumeration. The allowlist trigger on auth.users still
			 * gates who may be created. The register page then navigates to the
			 * confirm-otp page where the emailed code is entered.
			 */
			const { error } = await supabase.auth.signInWithOtp({
				email,
				options: {
					shouldCreateUser: true,
					data: { first_name: firstName, last_name: lastName },
				},
			});

			if (error) {
				useAuthErrorStore.getState().handleError(error, span);
				return { error };
			}

			return { error: null };
		},

		async updateEmail(newEmail: string) {
			const { error } = await updateEmail(newEmail);
			return { error };
		},

		resetUnconfirmedEmail: () => {
			set({ unconfirmedEmail: null, emailConfirmationStatus: "unknown" });
		},

		/**
		 * In case you wonder what is the difference between
		 * resendConfirmationEmail and resendOtpEmail with otpType "email":
		 *
		 * - resendConfirmationEmail is used to resend the email confirmation
		 * from the page that is shown after submitting the registration form
		 * or after trying to log in with an unconfirmed email.
		 * It uses the unconfirmed email from the store
		 * (the unconfirmed email is shared between different components)
		 *
		 * - resendOtpEmail with otpType "email" is used to resend the otp email
		 * from the confirm-otp page. The page reads the email from a query param.
		 */
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

			const { error } = await supabase.auth.signInWithOtp({
				email: unconfirmedEmail,
			});

			if (error) {
				resendTime = null;
				useAuthErrorStore.getState().handleError(error);
				throw error;
			}
		},

		resendOtpEmail: async ({ email, otpType }) => {
			/**
			 * For the login / sign-up code (otpType "email"), re-request via
			 * signInWithOtp so it works for both a brand-new sign-up (unconfirmed
			 * user) and an existing user logging in. auth.resend({type:"signup"})
			 * only works for unconfirmed sign-ups and errors for existing users.
			 */
			if (otpType === "email") {
				const { error } = await supabase.auth.signInWithOtp({ email });

				if (error) {
					useAuthErrorStore.getState().handleError(error);
				}

				return;
			}

			const { error } = await resendOtpEmail({ email, otpType });

			if (error) {
				useAuthErrorStore.getState().handleError(error);
			}
		},

		async requestLoginOtp({ email, span }) {
			/**
			 * Passwordless login: send a one-time code to an existing user.
			 * shouldCreateUser:false so login never silently creates an account —
			 * account creation only happens through the register page.
			 */
			const { error } = await supabase.auth.signInWithOtp({
				email,
				options: { shouldCreateUser: false },
			});

			// GoTrue's otp_disabled error means the email has no account — treated
			// as success so an attacker can't tell registered emails apart from
			// unregistered ones by whether the page navigates or shows an error.
			if (error && error.code !== "otp_disabled") {
				useAuthErrorStore.getState().handleError(error, span);
				return { error };
			}

			return { error: null };
		},

		async logout() {
			await supabase.auth.signOut();
			set({
				session: null,
				unconfirmedEmail: null,
				isBanned: null,
				emailConfirmationStatus: "unknown",
				isInitialized: true,
				isUserAdmin: false,
				isAdminStatusLoaded: false,
			});

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

		async checkIsUserBanned() {
			const isUserBanned = await getIsUserBanned();

			set({ isBanned: isUserBanned });
		},
	};
});
