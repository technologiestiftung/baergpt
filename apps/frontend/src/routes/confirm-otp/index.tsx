import { useState, type FormEvent, type ClipboardEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Content from "../../content";
import { ConfirmationLayout } from "../../layouts/confirmation-layout.tsx";
import { supabase } from "../../../supabase-client";
import { useErrorStore } from "../../store/error-store.ts";
import { useAuthStore } from "../../store/auth-store.ts";
import * as Sentry from "@sentry/react";

const redirectToMapping = {
	email: "/",
	recovery: "/reset-password/",
	email_change: "/email-changed/",
} as const;

const otpTypeSpanOpMapping = {
	email: "user.registration.email.confirm",
	recovery: "user.request-password-reset.confirm",
	email_change: "user.request-email-change.confirm",
};

export function ConfirmOtpPage() {
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [hasEmailBeenRecentlySent, setHasEmailBeenRecentlySent] =
		useState(false);
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();

	const email = searchParams.get("email");
	const otpType = searchParams.get("type");

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		setError(null);

		if (!email) {
			setError(Content["confirmOtp.error.missingFields"]);
			useErrorStore
				.getState()
				.handleError(
					new Error(
						"The confirm otp page was accessed without an email query parameter.",
					),
				);
			return;
		}

		if (!isOtpTypeValid(otpType)) {
			setError(Content["confirmOtp.error.generic"]);
			useErrorStore
				.getState()
				.handleError(
					new Error(
						`The confirm otp page was accessed with an invalid otp type query parameter: ${otpType}`,
					),
				);
			return;
		}

		setIsSubmitting(true);

		const token = event.currentTarget.token.value;

		const verifyParams = {
			type: otpType,
			email,
			token,
		};

		Sentry.startSpan(
			{
				name: `Confirm OTP for ${otpType}`,
				op: otpTypeSpanOpMapping[otpType],
			},
			async (span) => {
				const { error: verifyOtpError } =
					await supabase.auth.verifyOtp(verifyParams);

				setIsSubmitting(false);

				if (!verifyOtpError) {
					navigate(redirectToMapping[otpType]);
					return;
				}

				useErrorStore.getState().handleError(verifyOtpError, span);

				const isTokenExpiredOrInvalid = ["invalid", "expired"].some((word) =>
					verifyOtpError.message.includes(word),
				);

				if (isTokenExpiredOrInvalid) {
					setError(Content["confirmOtp.error.tokenExpiredOrInvalid"]);
					return;
				}

				setError(Content["confirmOtp.error.generic"]);
			},
		);
	};

	const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
		event.preventDefault();
		event.currentTarget.value = event.clipboardData.getData("text").trim();
	};

	const handleResendEmail = async () => {
		if (!email || !isOtpTypeValid(otpType)) {
			return;
		}

		await useAuthStore.getState().resendOtpEmail({ email, otpType });
		setHasEmailBeenRecentlySent(true);

		setTimeout(() => {
			setHasEmailBeenRecentlySent(false);
		}, 5_000);
	};

	return (
		<ConfirmationLayout>
			<div className="flex flex-col min-h-[95svh] h-full w-full justify-center items-center bg-hellblau-30 px-5 py-12 md:py-24">
				<div className="flex flex-col border max-w-[580px] w-full border-black py-8 px-5 md:p-10 rounded-3px bg-white">
					<h1 className="text-3xl leading-9 md:text-4xl md:leading-10 font-bold">
						{Content["confirmOtp.title"]}
					</h1>
					<p className="text-base mt-4 text-schwarz-100">
						{Content["confirmOtp.description"]}
					</p>

					<form className="flex flex-col mt-8 gap-6" onSubmit={handleSubmit}>
						<label
							htmlFor="token"
							className="flex flex-col gap-2 text-sm md:text-base"
						>
							{Content["confirmOtp.token.label"]}
							<input
								id="token"
								name="token"
								type="text"
								inputMode="numeric"
								pattern="\d{6}"
								className="border border-schwarz-40 rounded-3px px-3 py-2 focus-visible:outline-default uppercase tracking-[0.3em]"
								placeholder={Content["confirmOtp.token.placeholder"]}
								onPaste={handlePaste}
							/>
						</label>

						{error && (
							<div className="text-berlin-rot text-sm" role="alert">
								{error}
							</div>
						)}

						<button
							type="submit"
							disabled={isSubmitting}
							className="flex w-fit items-center gap-2 rounded-3px bg-dunkelblau-100 px-4 py-2 text-base text-white hover:bg-dunkelblau-80 focus-visible:outline-default disabled:opacity-60"
						>
							{isSubmitting
								? Content["confirmOtp.button.loading"]
								: Content["confirmOtp.button.submit"]}
						</button>

						<p>
							{Content["unconfirmedEmail.otp.resend"]}
							{hasEmailBeenRecentlySent && (
								<span className="ml-5 leading-6 md:text-lg md:leading-7 font-semibold text-mittelgruen">
									{Content["unconfirmedEmail.resend.success"]}
								</span>
							)}
							{!hasEmailBeenRecentlySent && (
								<button
									className="ml-5 leading-6 md:text-lg md:leading-7 font-semibold underline hover:no-underline"
									type="button"
									onClick={handleResendEmail}
								>
									{Content["unconfirmedEmail.resendButton"]}
								</button>
							)}
						</p>
					</form>
				</div>
			</div>
		</ConfirmationLayout>
	);
}

function isOtpTypeValid(
	otpType: string | null,
): otpType is keyof typeof redirectToMapping {
	if (!otpType) {
		return false;
	}

	return otpType in redirectToMapping;
}
