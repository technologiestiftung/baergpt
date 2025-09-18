import { ReactNode } from "react";
import { AuthHeader } from "../components/headers/auth/auth-header.tsx";
import { Footer } from "../components/footer/footer.tsx";
import { useAuthStore } from "../store/auth-store.ts";
import { Tooltip } from "../components/primitives/tooltip/tooltip.tsx";
import { ResetPasswordConfirmation } from "../components/reset-password-confirmation/reset-password-confirmation.tsx";
import { ResetPasswordSuccessful } from "../components/reset-password-successful/reset-password-successful.tsx";

interface PasswordResetLayoutProps {
	children: ReactNode;
}

export function PasswordResetLayout({ children }: PasswordResetLayoutProps) {
	const { isPasswordResetEmailSent, isPasswordResetSuccessful } =
		useAuthStore();

	return (
		<>
			<div className="flex flex-col min-h-svh">
				<AuthHeader />

				<main className="flex">
					{!isPasswordResetEmailSent && !isPasswordResetSuccessful && (
						<>{children}</>
					)}

					{isPasswordResetEmailSent && !isPasswordResetSuccessful && (
						<ResetPasswordConfirmation />
					)}

					{isPasswordResetSuccessful && <ResetPasswordSuccessful />}
				</main>
			</div>

			<Footer />
			<Tooltip />
		</>
	);
}
