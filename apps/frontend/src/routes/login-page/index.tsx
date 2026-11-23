import { type FormEvent, useRef } from "react";
import { useNavigate } from "react-router";
import { EmailInput } from "../../components/primitives/text-inputs/email-input.tsx";
import { BaerIcon } from "../../components/primitives/icons/baer-icon.tsx";
import { AuthLayout } from "../../layouts/auth-layout.tsx";
import { useAuthStore } from "../../store/auth-store.ts";
import Content from "../../content.ts";
import { AuthPrimaryButton } from "../../components/primitives/buttons/auth-primary-button.tsx";
import { useAuthErrorStore } from "../../store/auth-error-store.ts";
import * as Sentry from "@sentry/react";

export function LoginPage() {
	const { error, clearError } = useAuthErrorStore();
	const { requestLoginOtp } = useAuthStore();
	const navigate = useNavigate();
	const formRef = useRef<HTMLFormElement | null>(null);

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		clearError();

		const email = event.currentTarget.email.value;

		await Sentry.startSpan(
			{ name: "User Login", op: "user.login.submit" },
			async (span) => {
				const { error: loginError } = await requestLoginOtp({ email, span });

				if (!loginError) {
					navigate(
						`/confirm-otp/?type=email&email=${encodeURIComponent(email)}`,
					);
				}
			},
		);
	};

	return (
		<AuthLayout>
			<div className="flex flex-col min-h-[100svh] h-full w-full justify-center items-center bg-hellblau-30 px-5 py-12 md:py-[100px]">
				<div className="flex flex-col gap-10 border max-w-[580px] w-full border-dunkelblau-100 p-5 md:p-7 rounded-3px bg-white text-dunkelblau-100">
					<div className="flex flex-col gap-4">
						<div className="flex justify-center">
							<BaerIcon className="size-10 drop-shadow-[0_0_1.5px_rgba(36,61,100,0.3)]" />
						</div>
						<h1 className="text-3xl leading-9 md:text-4xl md:leading-10 font-bold">
							{Content["loginPage.h1"]}
						</h1>
						<p className="text-lg leading-7 md:text-xl md:leading-8">
							{Content["loginPage.h2"]}
						</p>
					</div>

					<form
						className="flex flex-col gap-10"
						ref={formRef}
						onSubmit={handleSubmit}
					>
						<div className="flex flex-col gap-1.5">
							<label htmlFor="email" className="text-sm leading-5 font-bold">
								{Content["loginPage.emailLabel"]}
							</label>
							<EmailInput
								id="email"
								placeholder="vorname.nachname@subdomain.berlin.de"
								useEmailAllowedCheck={false}
								className="h-12 !px-3 !border-dunkelblau-50 text-base leading-6 placeholder:text-dunkelblau-65"
							/>
							<p className="text-xs leading-4 text-dunkelblau-65">
								{Content["loginPage.otpHint"]}
							</p>

							{error && (
								<div
									className="text-berlin-rot mt-2.5 text-sm"
									dangerouslySetInnerHTML={{ __html: error }}
								/>
							)}
						</div>

						<AuthPrimaryButton type="submit">
							{Content["loginPage.submitButton"]}
						</AuthPrimaryButton>
					</form>
				</div>
			</div>
		</AuthLayout>
	);
}
