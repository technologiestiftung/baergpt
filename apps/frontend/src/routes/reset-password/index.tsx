import { useAuthStore } from "../../store/auth-store.ts";
import { ConfirmationLayout } from "../../layouts/confirmation-layout.tsx";
import { ResetPasswordSuccessful } from "../../components/reset-password-successful/reset-password-successful.tsx";
import { ResetPasswordForm } from "../../components/reset-password-form/reset-password-form.tsx";

export function ResetPasswordPage() {
	const { isPasswordResetSuccessful } = useAuthStore();

	return (
		<ConfirmationLayout>
			{isPasswordResetSuccessful && <ResetPasswordSuccessful />}

			{!isPasswordResetSuccessful && <ResetPasswordForm />}
		</ConfirmationLayout>
	);
}
