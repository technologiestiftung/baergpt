import { useState, type FormEvent, type ClipboardEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import Content from "../../content";
import { AuthPrimaryButton } from "../../components/primitives/buttons/auth-primary-button.tsx";
import { ConfirmationLayout } from "../../layouts/confirmation-layout.tsx";
import { supabase } from "../../../supabase-client";
import { useErrorStore } from "../../store/error-store.ts";
import { useAuthStore } from "../../store/auth-store.ts";
import * as Sentry from "@sentry/react";
import { hasCompletedRegistration } from "../../lib/has-completed-registration.ts";

const redirectToMapping = {
	email: "/",
	email_change: "/email-changed/",
} as const;

const otpTypeSpanOpMapping = {
	email: "user.login.email.confirm",
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
	const changeEmailPath = otpType === "email_change" ? "/profile/" : "/login/";

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
				const { data, error: verifyOtpError } =
					await supabase.auth.verifyOtp(verifyParams);

				setIsSubmitting(false);

				if (!verifyOtpError) {
					const isNewUser =
						data.session && !hasCompletedRegistration(data.session);
					navigate(isNewUser ? "/register/" : redirectToMapping[otpType]);
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
		setError(null);
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
				<div className="flex flex-col gap-10 border max-w-[580px] w-full border-dunkelblau-100 p-5 md:p-7 rounded-3px bg-white text-dunkelblau-100">
					<div className="flex flex-col gap-4">
						<h1 className="text-3xl leading-9 md:text-4xl md:leading-10 font-bold">
							{Content["confirmOtp.title"]}
						</h1>
						<p className="text-lg leading-7 md:text-xl md:leading-8">
							{email ? (
								<>
									{Content["confirmOtp.description.sent"]}{" "}
									<strong className="break-all">{email}</strong>{" "}
									{Content["confirmOtp.description.sentSuffix"]}
								</>
							) : (
								Content["confirmOtp.description"]
							)}
						</p>
					</div>

					<form className="flex flex-col gap-10" onSubmit={handleSubmit}>
						<div className="flex flex-col gap-1.5">
							<label htmlFor="token" className="text-sm leading-5 font-bold">
								{Content["confirmOtp.token.label"]}
							</label>
							<input
								id="token"
								name="token"
								type="text"
								inputMode="numeric"
								autoComplete="one-time-code"
								pattern="\d{10}"
								aria-invalid={!!error}
								aria-describedby={error ? "token-error" : undefined}
								className={`
									h-12 px-3 border rounded-3px text-base leading-6
									focus-visible:outline-default
									${error ? "border-warning-100 text-warning-120" : "border-dunkelblau-50"}
								`}
								onInput={() => setError(null)}
								onPaste={handlePaste}
							/>

							{error && (
								<p
									id="token-error"
									className="text-xs leading-4 text-warning-120"
									role="alert"
								>
									{error}
								</p>
							)}
						</div>

						<div className="flex flex-col gap-2">
							<AuthPrimaryButton type="submit" disabled={isSubmitting}>
								{isSubmitting
									? Content["confirmOtp.button.loading"]
									: Content["confirmOtp.button.submit"]}
							</AuthPrimaryButton>

							<button
								type="button"
								onClick={handleResendEmail}
								disabled={hasEmailBeenRecentlySent}
								aria-live="polite"
								className={`
									flex w-full h-11 px-5 items-center justify-center rounded-3px
									text-base leading-6 font-normal
									hover:bg-hellblau-100 focus-visible:outline-default
									disabled:text-mittelgruen disabled:hover:bg-transparent
								`}
							>
								{hasEmailBeenRecentlySent
									? Content["confirmOtp.resend.success"]
									: Content["confirmOtp.resend.button"]}
							</button>
						</div>
					</form>

					<p className="text-lg leading-7 text-center">
						{Content["confirmOtp.typo.question"]}{" "}
						<Link
							to={changeEmailPath}
							className="font-bold underline hover:no-underline focus-visible:outline-default rounded-3px"
						>
							{Content["confirmOtp.typo.changeEmailLink"]}
						</Link>
					</p>
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
