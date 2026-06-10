import { useEffect } from "react";
import { useAuthStore } from "../store/use-auth-store.ts";
import { useLocation, useNavigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { useAuthErrorStore } from "../store/use-auth-error-store.ts";
import { useIsActiveStore } from "../store/use-is-active-store.ts";

export function useSessionRedirect() {
	const session = useAuthStore((state) => state.session);
	const isActive = useIsActiveStore((state) => state.isActive);

	const location = useLocation();
	const navigate = useNavigate();

	useEffect(() => {
		redirectBasedOnSession({
			session,
			pathname: location.pathname,
			navigate,
			isActive,
		}).catch(console.error);
	}, [session, isActive, location.pathname, navigate]);
}

async function redirectBasedOnSession({
	session,
	pathname,
	navigate,
	isActive,
}: {
	session: Session | null | undefined;
	pathname: string;
	navigate: (path: string) => void;
	isActive: boolean | null;
}) {
	/**
	 * On first load the session is undefined and
	 * we don't know yet if the user has a session or not,
	 */
	if (session === undefined) {
		return;
	}

	if (!session) {
		handleUnauthorized(pathname, navigate);
		return;
	}

	if (isActive === null) {
		return;
	}

	if (isActive === false) {
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
	const unprotectedPages = ["/login/"];

	if (unprotectedPages.includes(pathname)) {
		return;
	}

	navigate("/login/");
}

function handleAuthorized(pathname: string, navigate: (path: string) => void) {
	const protectedPages = ["/", "/product-dashboard/", "/base-knowledge/"];

	// Allow access to protected pages
	if (protectedPages.includes(pathname)) {
		return;
	}

	navigate("/");
}
