import { useAuthStore } from "../../store/auth-store.ts";
import { ConfirmationLayout } from "../../layouts/confirmation-layout.tsx";
import { RequestPasswordReset } from "../../components/request-password-reset/request-password-reset.tsx";
import { RequestPasswordResetSuccessful } from "../../components/request-password-reset-successful/request-password-reset-successful.tsx";

export function RequestResetPasswordPage() {
	const { isPasswordResetEmailSent } = useAuthStore();

	return (
		<ConfirmationLayout>
			{!isPasswordResetEmailSent && <RequestPasswordReset />}

			{isPasswordResetEmailSent && <RequestPasswordResetSuccessful />}
		</ConfirmationLayout>
	);
}
