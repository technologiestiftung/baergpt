import { useState, type FormEvent, type ClipboardEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import Content from "../../content.ts";
import { AuthLayout } from "../../components/layout/auth-layout.tsx";
import { supabase } from "../../../supabase-client.ts";

export function ConfirmOtpPage() {
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [hasEmailBeenRecentlySent, setHasEmailBeenRecentlySent] =
		useState(false);
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();

	const email = searchParams.get("email");

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setError(null);

		if (!email) {
			setError(Content["confirmOtp.error.missingFields"]);
			return;
		}

		setIsSubmitting(true);

		const token = event.currentTarget.token.value;

		const { error: verifyOtpError } = await supabase.auth.verifyOtp({
			type: "email",
			email,
			token,
		});

		setIsSubmitting(false);

		if (!verifyOtpError) {
			navigate("/");
			return;
		}

		const isTokenExpiredOrInvalid = ["invalid", "expired"].some((word) =>
			verifyOtpError.message.includes(word),
		);

		setError(
			isTokenExpiredOrInvalid
				? Content["confirmOtp.error.tokenExpiredOrInvalid"]
				: Content["confirmOtp.error.generic"],
		);
	};

	const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
		event.preventDefault();
		event.currentTarget.value = event.clipboardData.getData("text").trim();
	};

	const handleResendEmail = async () => {
		if (!email) {
			return;
		}

		setError(null);

		const { error: resendError } = await supabase.auth.signInWithOtp({
			email,
			options: { shouldCreateUser: false },
		});

		if (resendError) {
			setError(Content["confirmOtp.error.generic"]);
			return;
		}

		setHasEmailBeenRecentlySent(true);

		setTimeout(() => {
			setHasEmailBeenRecentlySent(false);
		}, 5_000);
	};

	return (
		<AuthLayout>
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
								required
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
							{Content["confirmOtp.resend"]}
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
		</AuthLayout>
	);
}
