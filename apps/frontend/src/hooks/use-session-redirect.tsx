import { useEffect } from "react";
import { useAuthStore } from "../store/auth-store.ts";
import { useLocation, useNavigate } from "react-router";
import type { Session } from "@supabase/supabase-js";
import { useErrorStore } from "../store/error-store.ts";
import { useAuthErrorStore } from "../store/auth-error-store.ts";

export function useSessionRedirect() {
	const session = useAuthStore((state) => state.session);
	const isBannedOrDeleted = useAuthStore((state) => state.isBannedOrDeleted);

	const location = useLocation();
	const navigate = useNavigate();

	useEffect(() => {
		// Check for Supabase authentication error in URL hash
		const hash = window.location.hash;
		if (
			hash.includes("error=access_denied") &&
			hash.includes("error_code=otp_expired")
		) {
			// Clear the hash from the URL
			window.history.replaceState(null, "", window.location.pathname);
			// Navigate to the registration error page
			navigate("/registration-error/");
			return;
		}

		redirectBasedOnSession({
			session,
			pathname: location.pathname,
			navigate,
			isBannedOrDeleted,
		}).catch(useErrorStore.getState().handleError);
	}, [session, location, isBannedOrDeleted, navigate]);
}

async function redirectBasedOnSession({
	session,
	pathname,
	navigate,
	isBannedOrDeleted,
}: {
	session: Session | null | undefined;
	pathname: string;
	navigate: (path: string) => void;
	isBannedOrDeleted: boolean | null;
}) {
	/**
	 * On first load the session and user are undefined, and
	 * we don't know yet if the user has an active session or not,
	 * so we don't do anything.
	 */
	if (session === undefined) {
		return;
	}

	/**
	 * If the session is null, the user is logged out
	 */
	if (session === null) {
		handleUnauthorized(pathname, navigate);
		return;
	}

	/**
	 * If isBannedOrDeleted is null, we don't know yet if the user has been banned or not
	 */
	if (isBannedOrDeleted === null) {
		return;
	}

	/**
	 * If the user is banned or has been deleted, we log them out
	 */
	if (isBannedOrDeleted) {
		await useAuthStore.getState().logout();
		useAuthErrorStore
			.getState()
			.handleError(new Error("User account has been deactivated."));
		return;
	}

	handleAuthorized(pathname, navigate);
}

function handleUnauthorized(
	pathname: string,
	navigate: (path: string) => void,
) {
	const unprotectedPages = [
		"/login/",
		"/register/",
		"/account-deleted/",
		"/",
		"/registration-error/",
	];

	if (unprotectedPages.includes(pathname)) {
		return;
	}

	navigate("/");
}

function handleAuthorized(pathname: string, navigate: (path: string) => void) {
	const protectedPages = ["/", "/profile/", "/email-changed/"];

	// Allow access to protected pages
	if (protectedPages.includes(pathname)) {
		return;
	}

	navigate("/");
}
