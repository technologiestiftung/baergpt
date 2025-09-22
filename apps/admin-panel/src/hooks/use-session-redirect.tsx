import { useEffect } from "react";
import { useAuthStore } from "../store/use-auth-store.ts";
import { useLocation, useNavigate } from "react-router-dom";
import { Session } from "@supabase/supabase-js";

export function useSessionRedirect() {
	const session = useAuthStore((state) => state.session);

	const location = useLocation();
	const navigate = useNavigate();

	useEffect(() => {
		redirectBasedOnSession({
			session,
			pathname: location.pathname,
			navigate,
		});

		if (!session) {
			return;
		}
	}, [session]);
}

function redirectBasedOnSession({
	session,
	pathname,
	navigate,
}: {
	session: Session | null | undefined;
	pathname: string;
	navigate: (path: string) => void;
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
	const protectedPages = ["/", "/account-activated/", "/base-knowledge/"];

	// Allow access to protected pages
	if (protectedPages.includes(pathname)) {
		return;
	}

	navigate("/");
}
