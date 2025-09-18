import React, { FormEvent, useRef, useState } from "react";
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

export function RegisterPage() {
	const { register } = useAuthStore();
	const { error } = useAuthErrorStore();
	const { showTooltip, hideTooltip } = useTooltipStore();
	const [hasAcceptedPrivacy, setHasAcceptedPrivacy] = useState(false);
	const formRef = useRef<HTMLFormElement | null>(null);

	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		const firstName = event.currentTarget.firstName.value;
		const lastName = event.currentTarget.lastName.value;
		const email = event.currentTarget.email.value;
		const password = event.currentTarget.password.value;

		register({ firstName, lastName, email, password });
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
			<div className="flex flex-col min-h-[90svh] w-full justify-center items-center md:bg-hellblau-30 py-12 md:py-[100px] px-5">
				<div className="flex flex-col border border-black py-8 px-5 md:p-10 rounded-3px bg-white">
					<h1 className="text-3xl leading-9 md:text-4xl md:leading-10 font-bold">
						{Content["registerPage.h1"]}
					</h1>

					<form
						className="flex flex-col mt-12"
						ref={formRef}
						onSubmit={handleSubmit}
					>
						<div className="flex gap-5">
							<label
								htmlFor="firstName"
								className="flex flex-col gap-y-1 text-sm md:text-base"
							>
								{Content["registerPage.firstNameLabel"]}
								<TextInput
									id="firstName"
									placeholder={Content["registerPage.firstNamePlaceholder"]}
								/>
							</label>

							<label
								htmlFor="lastName"
								className="flex flex-col gap-y-1 text-sm md:text-base"
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
							<PasswordInput id="password" />
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
								<span className="flex gap-x-1 text-sm md:text-base">
									<a
										href={Content["footer.privacy.link"]}
										className="underline hover:no-underline rounded-3px focus-visible:outline-default cursor-pointer"
										target="_blank"
									>
										{Content["registerPage.privacyLink"]}
									</a>
									<span data-testid={`label-has-accepted-privacy-checkbox`}>
										{Content["registerPage.privacyText"]}
									</span>
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
