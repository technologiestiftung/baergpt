import type { VerifyOtpParams } from "@supabase/supabase-js";
import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import Content from "../../content";
import { PasswordResetLayout } from "../../layouts/pasword-reset-layout";
import { supabase } from "../../../supabase-client";

type OtpType = "recovery" | "signup" | "invite" | "email_change";

interface ConfirmOtpPageProps {
	defaultType: OtpType;
	successRedirect: string;
}

function ConfirmOtpPage({ defaultType, successRedirect }: ConfirmOtpPageProps) {
	const [searchParams] = useSearchParams();
	const email = searchParams.get("email") ?? "";
	const [token, setToken] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const navigate = useNavigate();

	const redirectTo = searchParams.get("redirect_to") ?? successRedirect;

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setError(null);

		if (!email || !token) {
			setError(Content["confirmOtp.error.missingFields"]);
			return;
		}

		setIsSubmitting(true);

		try {
			const verifyParams: VerifyOtpParams = {
				type: defaultType,
				email,
				token,
			};

			const { error: verifyError } =
				await supabase.auth.verifyOtp(verifyParams);

			if (verifyError) {
				throw verifyError;
			}
			if (redirectTo.startsWith("http")) {
				try {
					const url = new URL(redirectTo);
					// If same origin, use client-side navigation to preserve state
					if (url.origin === window.location.origin) {
						navigate(url.pathname + url.search + url.hash, { replace: true });
					} else {
						window.location.assign(redirectTo);
					}
				} catch {
					window.location.assign(redirectTo);
				}
			} else {
				navigate(redirectTo, { replace: true });
			}
		} catch (err) {
			if (err instanceof Error) {
				if (
					err.message === "Token has expired or is invalid" ||
					err.message.includes("expired") ||
					err.message.includes("invalid")
				) {
					setError(Content["confirmOtp.error.tokenExpiredOrInvalid"]);
				} else {
					setError(err.message);
				}
			} else {
				setError(Content["confirmOtp.error.generic"]);
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<PasswordResetLayout>
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
								type="text"
								inputMode="numeric"
								pattern="\d{6}"
								className="border border-schwarz-40 rounded-3px px-3 py-2 focus-visible:outline-default uppercase tracking-[0.3em]"
								placeholder={Content["confirmOtp.token.placeholder"]}
								value={token}
								onChange={(event) => setToken(event.target.value)}
								onBlur={() => setToken((currentToken) => currentToken.trim())}
								onPaste={(event) => {
									event.preventDefault();
									const pastedText = event.clipboardData?.getData("text") ?? "";
									const input = event.currentTarget;
									const selectionStart = input.selectionStart ?? token.length;
									const selectionEnd = input.selectionEnd ?? token.length;
									const sanitized = pastedText.replace(/\s+/g, "");
									const nextValue =
										input.value.slice(0, selectionStart) +
										sanitized +
										input.value.slice(selectionEnd);
									setToken(nextValue);
								}}
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
					</form>
				</div>
			</div>
		</PasswordResetLayout>
	);
}

export function ConfirmResetPage() {
	return (
		<ConfirmOtpPage defaultType="recovery" successRedirect="/new-password/" />
	);
}

export function ConfirmEmailChangePage() {
	return (
		<ConfirmOtpPage
			defaultType="email_change"
			successRedirect="/email-changed/"
		/>
	);
}
