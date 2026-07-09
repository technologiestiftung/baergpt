import { useEffect } from "react";
import { useAuthStore } from "../store/use-auth-store.ts";
import { useLocation, useNavigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { useAuthErrorStore } from "@/store/use-auth-error-store.ts";
import { useUserStore } from "@/store/use-user-store.ts";

export function useSessionRedirect() {
	const session = useAuthStore((state) => state.session);
	const isUserAdmin = useUserStore((state) => state.isUserAdmin);

	const location = useLocation();
	const navigate = useNavigate();

	useEffect(() => {
		redirectBasedOnSession({
			session,
			pathname: location.pathname,
			navigate,
			isUserAdmin,
		}).catch(console.error);
	}, [session, location.pathname, navigate, isUserAdmin]);
}

async function redirectBasedOnSession({
	session,
	pathname,
	navigate,
	isUserAdmin,
}: {
	session: Session | null | undefined;
	pathname: string;
	navigate: (path: string) => void;
	isUserAdmin: boolean | null;
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

	if (isUserAdmin === null) {
		return;
	}

	if (!isUserAdmin) {
		await useAuthStore.getState().logout();
		useAuthErrorStore
			.getState()
			.handleError(new Error("User account is not admin or has been banned."));
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
	const protectedPages = [
		"/",
		"/product-dashboard/",
		"/base-knowledge/",
		"/domain-allowlist/",
	];

	// Allow access to protected pages
	if (protectedPages.includes(pathname)) {
		return;
	}

	navigate("/");
}
