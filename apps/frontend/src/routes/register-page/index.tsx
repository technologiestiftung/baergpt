import React, { type FormEvent, useRef, useState, useEffect } from "react";
import Checkbox from "../../components/primitives/checkboxes/checkbox.tsx";
import Content from "../../content.ts";
import { TextInput } from "../../components/primitives/text-inputs/text-input.tsx";
import { EmailInput } from "../../components/primitives/text-inputs/email-input.tsx";
import { PasswordInput } from "../../components/primitives/text-inputs/password-input.tsx";
import { ArrowWhiteRightIcon } from "../../components/primitives/icons/arrow-white-right-icon.tsx";
import { AuthLayout } from "../../layouts/auth-layout.tsx";
import { useAuthStore } from "../../store/auth-store.ts";
import { useAuthErrorStore } from "../../store/auth-error-store.ts";
import { QuestionMarkIcon } from "../../components/primitives/icons/question-mark-icon.tsx";
import { useTooltipStore } from "../../store/tooltip-store.ts";
import { ChevronIcon } from "../../components/primitives/icons/chevron-icon.tsx";

export function RegisterPage() {
	const { register, getAllowedEmailDomains } = useAuthStore();
	const { error } = useAuthErrorStore();
	const { showTooltip, hideTooltip } = useTooltipStore();
	const [hasAcceptedPrivacy, setHasAcceptedPrivacy] = useState(false);
	const [hasAcceptedPersonalData, setHasAcceptedPersonalData] = useState(false);
	const [isNoticeExpanded, setIsNoticeExpanded] = useState(false);
	const formRef = useRef<HTMLFormElement | null>(null);

	useEffect(() => {
		const controller = new AbortController();
		getAllowedEmailDomains(controller.signal);

		return () => {
			controller.abort();
		};
	}, []);

	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		const firstName = event.currentTarget.firstName.value;
		const lastName = event.currentTarget.lastName.value;
		const email = event.currentTarget.email.value;
		const password = event.currentTarget.password.value;

		register({ firstName, lastName, email, password });
	};

	const handleChange = (event: React.ChangeEvent<HTMLFormElement>) => {
		const password = event.currentTarget.password.value;
		const repeatPassword = event.currentTarget.repeatPassword.value;

		const isDifferent = password !== repeatPassword;

		if (isDifferent) {
			event.currentTarget.repeatPassword.setCustomValidity(
				Content["form.validation.password.repeatPasswordShouldMatch.error"],
			);
			return;
		}

		event.currentTarget.repeatPassword.setCustomValidity("");
	};

	const handleShowPasswordTooltip = (
		event: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>,
	) => {
		showTooltip({
			event,
			content: Content["registerPage.passwordTooltip"],
			width: "13rem",
		});
	};

	return (
		<AuthLayout>
			<div className="flex flex-col min-h-[100svh] h-full w-full justify-center items-center bg-hellblau-30 px-5 py-12 md:py-[100px]">
				<div className="flex flex-col max-w-[590px] border border-black py-8 px-5 md:p-10 rounded-3px bg-white">
					<h1 className="text-3xl leading-9 md:text-4xl md:leading-10 font-bold">
						{Content["registerPage.h1"]}
					</h1>
					<div className="flex gap-3 bg-hellblau-55 p-3 rounded-3px mt-5 text-start break-words">
						<img
							className="self-start"
							src="/icons/info-dark-icon.svg"
							alt="info-icon"
						/>

						<div className="flex flex-col gap-3 min-w-0">
							<p className="text-sm leading-5 md:text-base md:leading-6 font-semibold">
								{Content["registerPage.notice.heading"]}
							</p>
							{isNoticeExpanded && (
								<>
									<div>
										<p className="text-sm leading-5 md:text-base md:leading-6 font-normal">
											{Content["registerPage.notice.content.p1"]}
										</p>
										<p className="text-sm leading-5 md:text-base md:leading-6 font-normal">
											{Content["registerPage.notice.content.p2"]}
										</p>
									</div>
									<p className="text-sm leading-5 md:text-base md:leading-6 font-normal">
										{Content["registerPage.notice.content.p3"]}
									</p>
								</>
							)}
							<button
								className="flex items-center text-sm leading-5 md:text-base md:leading-6 font-normal focus-visible:outline-default rounded-3px text-start w-fit"
								aria-label={
									isNoticeExpanded
										? Content["registerPage.notice.showLess.button.ariaLabel"]
										: Content["registerPage.notice.showMore.button.ariaLabel"]
								}
								onClick={() => setIsNoticeExpanded(!isNoticeExpanded)}
							>
								{isNoticeExpanded
									? Content["registerPage.notice.showLess.button.label"]
									: Content["registerPage.notice.showMore.button.label"]}
								{isNoticeExpanded ? (
									<ChevronIcon color="dunkelblau-200" direction="up" />
								) : (
									<ChevronIcon color="dunkelblau-200" direction="down" />
								)}
							</button>
						</div>
					</div>

					<form
						className="flex flex-col mt-12"
						ref={formRef}
						onSubmit={handleSubmit}
						onChange={handleChange}
					>
						<div className="flex gap-5">
							<label
								htmlFor="firstName"
								className="flex flex-col gap-y-1 text-sm md:text-base flex-1"
							>
								{Content["registerPage.firstNameLabel"]}
								<TextInput
									id="firstName"
									placeholder={Content["registerPage.firstNamePlaceholder"]}
								/>
							</label>

							<label
								htmlFor="lastName"
								className="flex flex-col gap-y-1 text-sm md:text-base flex-1"
							>
								{Content["registerPage.lastNameLabel"]}
								<TextInput
									id="lastName"
									placeholder={Content["registerPage.lastNamePlaceholder"]}
								/>
							</label>
						</div>

						<label
							htmlFor="email"
							className="flex flex-col mt-4 md:mt-5 text-sm md:text-base"
						>
							{Content["registerPage.emailLabel"]}
							<div className="text-schwarz-40 text-sm mb-1">
								{Content["registerPage.emailHint"]}
							</div>
							<EmailInput
								id="email"
								placeholder={Content["registerPage.emailPlaceholder"]}
								useRegexValidation={true}
							/>
						</label>

						<label
							htmlFor="password"
							className="flex flex-col mt-4 md:mt-5 gap-y-1 text-sm md:text-base"
						>
							<span className="flex gap-x-1 items-center">
								{Content["registerPage.passwordLabel"]}
								<button
									type="button"
									className="rounded-3px focus-visible:outline-default"
									onMouseEnter={handleShowPasswordTooltip}
									onMouseLeave={hideTooltip}
									onFocus={handleShowPasswordTooltip}
									onBlur={hideTooltip}
								>
									<QuestionMarkIcon />
								</button>
							</span>
							<PasswordInput id="password" minLength={10} />
						</label>

						<label
							htmlFor="repeatPassword"
							className="flex flex-col mt-4 md:mt-5 gap-y-1 text-sm md:text-base"
						>
							{Content["registerPage.repeatPasswordLabel"]}
							<PasswordInput id="repeatPassword" />
						</label>

						<div className="mt-6">
							<Checkbox
								id="has-accepted-privacy"
								checked={hasAcceptedPrivacy}
								onChange={setHasAcceptedPrivacy}
								required={true}
							>
								<span className="flex flex-row flex-wrap gap-x-1 text-sm md:text-base">
									<a
										href={Content["footer.privacy.link"]}
										className="underline hover:no-underline rounded-3px focus-visible:outline-default cursor-pointer"
										target="_blank"
									>
										{Content["registerPage.privacyLink.label"]}
									</a>
									<span>{Content["registerPage.privacyText.p1"]}</span>
									<a
										href={Content["footer.termsOfUse.link"]}
										className="underline hover:no-underline rounded-3px focus-visible:outline-default cursor-pointer"
										target="_blank"
									>
										{Content["registerPage.termsOfUse.label"]}
									</a>
									<span data-testid={`label-has-accepted-privacy-checkbox`}>
										{Content["registerPage.privacyText.p2"]}
									</span>
								</span>
							</Checkbox>
						</div>

						<div className="mt-3">
							<Checkbox
								id="has-accepted-personal-data"
								checked={hasAcceptedPersonalData}
								onChange={setHasAcceptedPersonalData}
								required={true}
							>
								<span
									className="text-sm md:text-base"
									data-testid={`label-has-accepted-personal-data-checkbox`}
								>
									{Content["registerPage.personalData.label"]}
								</span>
							</Checkbox>
						</div>

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
							{Content["registerPage.submitButton"]}
							<ArrowWhiteRightIcon />
						</button>
					</form>
				</div>
				<p className="mt-6 text-center md:text-left">
					{Content["registerPage.loginPrompt"]}{" "}
					<br className="block md:hidden" />
					<a
						href="/login/"
						className={`
							font-bold underline hover:no-underline rounded-3px
							cursor-pointer focus-visible:outline-default
						`}
					>
						{Content["registerPage.loginLink"]}
					</a>
				</p>
			</div>
		</AuthLayout>
	);
}
