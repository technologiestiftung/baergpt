import { type FormEvent, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { EmailInput } from "../../components/primitives/text-inputs/email-input.tsx";
import { ArrowWhiteRightIcon } from "../../components/primitives/icons/arrow-white-right-icon.tsx";
import { ChevronIcon } from "../../components/primitives/icons/chevron-icon.tsx";
import { AuthLayout } from "../../layouts/auth-layout.tsx";
import { useAuthStore } from "../../store/auth-store.ts";
import Content from "../../content.ts";
import { useAuthErrorStore } from "../../store/auth-error-store.ts";
import * as Sentry from "@sentry/react";

export function LoginPage() {
	const { error } = useAuthErrorStore();
	const { requestLoginOtp } = useAuthStore();
	const navigate = useNavigate();
	const formRef = useRef<HTMLFormElement | null>(null);
	const [isNoticeExpanded, setIsNoticeExpanded] = useState(false);

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		const email = event.currentTarget.email.value;

		await Sentry.startSpan(
			{ name: "User Login", op: "user.login.submit" },
			async (span) => {
				const { error: loginError } = await requestLoginOtp({ email, span });

				if (!loginError) {
					navigate(
						`/confirm-otp/?type=email&email=${encodeURIComponent(email)}&origin=login`,
					);
				}
			},
		);
	};

	return (
		<AuthLayout>
			<div className="flex flex-col min-h-[100svh] h-full w-full justify-center items-center bg-hellblau-30 px-5 py-12 md:py-[100px]">
				<div className="flex flex-col border max-w-[580px] w-full border-black py-8 px-5 md:p-10 rounded-3px bg-white">
					<h1 className="text-3xl leading-9 md:text-4xl md:leading-10 font-bold">
						{Content["loginPage.h1"]}
					</h1>
					<h2 className="text-xl">{Content["loginPage.h2"]}</h2>

					<div className="flex gap-3 bg-hellblau-55 p-3 rounded-3px mt-5 text-start break-words">
						<img
							className="self-start"
							src="/icons/info-dark-icon.svg"
							alt="info-icon"
						/>

						<div className="flex flex-col gap-3 min-w-0" id="login-notice">
							<p className="text-sm leading-5 md:text-base md:leading-6 font-semibold">
								{Content["loginPage.notice.heading"]}
							</p>
							{isNoticeExpanded && (
								<p className="text-sm leading-5 md:text-base md:leading-6 font-normal">
									{Content["loginPage.notice.body"]}
								</p>
							)}
							<button
								type="button"
								className="flex items-center text-sm leading-5 md:text-base md:leading-6 font-normal focus-visible:outline-default rounded-3px text-start w-fit"
								aria-label={
									isNoticeExpanded
										? Content["loginPage.notice.showLess.button.ariaLabel"]
										: Content["loginPage.notice.showMore.button.ariaLabel"]
								}
								aria-expanded={isNoticeExpanded}
								aria-controls="login-notice"
								onClick={() => setIsNoticeExpanded(!isNoticeExpanded)}
							>
								{isNoticeExpanded
									? Content["loginPage.notice.showLess.button.label"]
									: Content["loginPage.notice.showMore.button.label"]}
								{isNoticeExpanded ? (
									<ChevronIcon color="dunkelblau-200" direction="up" />
								) : (
									<ChevronIcon color="dunkelblau-200" direction="down" />
								)}
							</button>
						</div>
					</div>

					<form
						className="flex flex-col mt-9"
						ref={formRef}
						onSubmit={handleSubmit}
					>
						<label htmlFor="email" className="flex flex-col gap-y-1">
							{Content["loginPage.emailLabel"]}
							<EmailInput
								id="email"
								placeholder="vorname.name@subdomain.berlin.de"
								useEmailAllowedCheck={false}
							/>
						</label>

						<p className="mt-3 text-sm leading-5 text-schwarz-100">
							{Content["loginPage.otpHint"]}
						</p>

						{error && (
							<div
								className="text-berlin-rot mt-4 text-sm"
								dangerouslySetInnerHTML={{ __html: error }}
							/>
						)}

						<button
							type="submit"
							className={`
								flex gap-x-2 text-lg mt-12 self-end items-center
								w-fit py-2 px-3 text-white rounded-3px 
								bg-dunkelblau-100 disabled:bg-schwarz-40
								hover:bg-dunkelblau-80 focus-visible:outline-default 
							`}
						>
							{Content["loginPage.submitButton"]}
							<ArrowWhiteRightIcon />
						</button>
					</form>
				</div>
				<p className="mt-6 text-center md:text-left">
					{Content["loginPage.registerPrompt"]}{" "}
					<br className="block md:hidden" />
					<a
						href={"/register/"}
						className="font-bold underline hover:no-underline"
					>
						{Content["loginPage.registerLink"]}
					</a>
				</p>
			</div>
		</AuthLayout>
	);
}
