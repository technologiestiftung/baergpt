import { ReactNode } from "react";
import { AuthHeader } from "../components/headers/auth/auth-header.tsx";
import { Footer } from "../components/footer/footer.tsx";
import { useSessionRedirect } from "../hooks/use-session-redirect.tsx";
import { useAuthStore } from "../store/auth-store.ts";
import { UnconfirmedEmail } from "../components/unconfirmed-email/unconfirmed-email.tsx";
import { Tooltip } from "../components/primitives/tooltip/tooltip.tsx";

interface AuthLayoutProps {
	children: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
	const { emailConfirmationStatus, isInitialized } = useAuthStore();

	useSessionRedirect();

	if (!isInitialized) {
		return null;
	}

	const hasConfirmedEmail = emailConfirmationStatus === "confirmed";
	const isConfirmationStatusUnknown = emailConfirmationStatus === "unknown";

	return (
		<>
			<div className="flex flex-col min-h-svh">
				<AuthHeader />

				<main className="flex">
					{/* Before log-in and registration, */}
					{/* the email confirmation status is unknown, */}
					{/* OR if the email has been confirmed for /account-activated */}
					{/* so we just render the page as is */}
					{(isConfirmationStatusUnknown || hasConfirmedEmail) && (
						<>{children}</>
					)}

					{/* If you have not confirmed your email yet, */}
					{/* you'll be asked to confirm first */}
					{/* (e.g. after registration, or log-in) */}
					{/* This has to be rendered here (on an unprotected page) */}
					{/* as you can't log in while your e-mail is unconfirmed */}
					{!isConfirmationStatusUnknown && !hasConfirmedEmail && (
						<UnconfirmedEmail />
					)}
				</main>
			</div>

			<Footer />
			<Tooltip />
		</>
	);
}
