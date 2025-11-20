import React, { useState, useRef, type FormEvent } from "react";
import { AuthLayout } from "../../layouts/auth-layout.tsx";
import { ArrowWhiteRightIcon } from "../../components/primitives/icons/arrow-white-right-icon.tsx";
import Content from "../../content.ts";
import { useAuthErrorStore } from "../../store/auth-error-store.ts";
import { useTooltipStore } from "../../store/tooltip-store.ts";
import { TextInput } from "../../components/primitives/text-inputs/text-input.tsx";
import { PasswordInput } from "../../components/primitives/text-inputs/password-input.tsx";
import Checkbox from "../../components/primitives/checkboxes/checkbox.tsx";
import { QuestionMarkIcon } from "../../components/primitives/icons/question-mark-icon.tsx";
import { Dropdown } from "../../components/primitives/dropdown/dropdown.tsx";
import { useAuthStore } from "../../store/auth-store.ts";
import { useNavigate } from "react-router-dom";
import { logAccountActivation } from "../../api/auth/log-account-activation.ts";
import { useIsActiveStore } from "../../store/use-is-active-store.ts";
import { useUserStore } from "../../store/user-store.ts";
import { useErrorStore } from "../../store/error-store.ts";

export function AccountActivated() {
	const { session, updatePassword } = useAuthStore();
	const { updateUser } = useUserStore();
	const { error } = useAuthErrorStore();
	const { getAccountActivationTimestamp } = useIsActiveStore();
	const navigate = useNavigate();

	const { showTooltip, hideTooltip } = useTooltipStore();
	const [hasAcceptedPrivacy, setHasAcceptedPrivacy] = useState(false);
	const [hasAcceptedPersonalData, setHasAcceptedPersonalData] = useState(false);
	const formRef = useRef<HTMLFormElement | null>(null);

	const { first_name, last_name } = session?.user?.user_metadata || {};
	const { email } = session?.user || {};

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		const personalTitle = event.currentTarget.personalTitle.value;
		const academicTitle = event.currentTarget.academicTitle.value;
		const firstName = event.currentTarget.firstName.value || first_name;
		const lastName = event.currentTarget.lastName.value || last_name;
		const password = event.currentTarget.password.value;

		await updateUser({
			first_name: firstName,
			last_name: lastName,
			academic_title: academicTitle,
			personal_title: personalTitle,
		});

		await updatePassword(password);

		if (!useErrorStore.getState().error) {
			// Mark the account activation as completed
			try {
				await logAccountActivation();
				// Refresh the account activation timestamp in the store
				await getAccountActivationTimestamp();
			} catch (activationError) {
				useErrorStore.getState().handleError(activationError);
			}

			navigate("/");
		}
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

	return (
		<AuthLayout>
			<div className="flex flex-col min-h-[90svh] w-full justify-center items-center bg-hellblau-30 py-12 md:py-[100px] px-5">
				<div className="flex flex-col border border-black py-8 px-5 md:p-10 rounded-3px bg-white md:min-w-[580px] w-full">
					<h1 className="text-3xl leading-9 md:text-4xl md:leading-10 font-bold">
						{Content["accountActivated.h1"]}
					</h1>
					<h2 className="text-lg mt-2">{Content["accountActivated.h2"]} für</h2>
					<h2 className="text-lg font-bold"> {email}</h2>
					<form
						className="flex flex-col mt-10"
						ref={formRef}
						onSubmit={handleSubmit}
						onChange={handleChange}
					>
						<div className="flex gap-5 w-full">
							<label
								htmlFor="personalTitle"
								className="flex flex-col gap-y-1 text-sm md:text-base"
							>
								{Content["accountActivated.personalTitleLabel"]}

								<Dropdown
									id="personalTitle"
									className="w-[148px] sm:w-[178px] md:w-[239px]"
									emptyLabel={
										Content["accountActivated.personalTitle.defaultOption"]
									}
									options={Content["accountActivated.personalTitle.options"]}
								/>
							</label>
							<label
								htmlFor="academicTitle"
								className="flex flex-col gap-y-1 text-sm md:text-base"
							>
								{Content["accountActivated.academicTitleLabel"]}
								<Dropdown
									id="academicTitle"
									className="w-[148px] sm:w-[178px] md:w-[239px]"
									emptyLabel={
										Content["accountActivated.academicTitle.defaultOption"]
									}
									options={Content["accountActivated.academicTitle.options"]}
								/>
							</label>
						</div>

						<div className="flex gap-5 mt-4 md:mt-5">
							<label
								htmlFor="firstName"
								className="flex flex-col gap-y-1 text-sm md:text-base grow"
							>
								{Content["accountActivated.firstNameLabel"]}
								<TextInput id="firstName" defaultValue={first_name} />
							</label>

							<label
								htmlFor="lastName"
								className="flex flex-col gap-y-1 text-sm md:text-base grow"
							>
								{Content["accountActivated.lastNameLabel"]}
								<TextInput id="lastName" defaultValue={last_name} />
							</label>
						</div>

						<label
							htmlFor="password"
							className="flex flex-col mt-4 md:mt-5 gap-y-1 text-sm md:text-base"
						>
							<span className="flex gap-x-1 items-center">
								{Content["accountActivated.passwordLabel"]}
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
							{Content["accountActivated.repeatPasswordLabel"]}
							<PasswordInput id="repeatPassword" minLength={10} />
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
							{Content["accountActivated.submitButton"]}
							<ArrowWhiteRightIcon />
						</button>
					</form>
				</div>
			</div>
		</AuthLayout>
	);
}
