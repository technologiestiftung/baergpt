import { useEffect } from "react";
import { useAuthStore } from "../store/auth-store.ts";
import { useLocation, useNavigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { useAuthErrorStore } from "../store/auth-error-store.ts";
import { useIsActiveStore } from "../store/use-is-active-store.ts";
import { useErrorStore } from "../store/error-store.ts";

export function useSessionRedirect() {
	const session = useAuthStore((state) => state.session);
	const isActive = useIsActiveStore((state) => state.isActive);
	const registrationFinishedAt = useIsActiveStore(
		(state) => state.registrationFinishedAt,
	);

	const location = useLocation();
	const navigate = useNavigate();

	useEffect(() => {
		redirectBasedOnSession({
			session,
			pathname: location.pathname,
			navigate,
			isActive,
			registrationFinishedAt,
		}).catch(useErrorStore.getState().handleError);
	}, [session, isActive, registrationFinishedAt, location]);
}

async function redirectBasedOnSession({
	session,
	pathname,
	navigate,
	isActive,
	registrationFinishedAt,
}: {
	session: Session | null | undefined;
	pathname: string;
	navigate: (path: string) => void;
	isActive: boolean | null;
	registrationFinishedAt: string | null | undefined;
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
	 * If isActive is null, we don't know yet if the user is active or not
	 */
	if (isActive === null) {
		return;
	}

	/**
	 * If the user is not active, we log them out
	 */
	if (isActive === false) {
		await useAuthStore.getState().logout();
		useAuthErrorStore
			.getState()
			.handleError(new Error("User account has been deactivated."));
		return;
	}

	/**
	 * If the registrationFinishedAt is undefined, we don't know yet if the user has completed the registration or not.
	 * The user might have also registered so no registrationFinishedAt timestamp is set and no redirection to /account-activated/ is needed.
	 */
	if (registrationFinishedAt === undefined) {
		return;
	}

	/**
	 * If the user has completed activation but is on the activation page, redirect to home
	 */
	if (registrationFinishedAt !== null && pathname === "/account-activated/") {
		navigate("/");
		return;
	}

	handleAuthorized(pathname, navigate);
}

function handleUnauthorized(
	pathname: string,
	navigate: (path: string) => void,
) {
	const unprotectedPages = ["/login/", "/register/", "/account-deleted/", "/"];

	if (unprotectedPages.includes(pathname)) {
		return;
	}

	navigate("/");
}

function handleAuthorized(pathname: string, navigate: (path: string) => void) {
	const protectedPages = [
		"/",
		"/account-activated/",
		"/profile/",
		"/email-changed/",
	];

	// Allow access to protected pages
	if (protectedPages.includes(pathname)) {
		return;
	}

	navigate("/");
}
