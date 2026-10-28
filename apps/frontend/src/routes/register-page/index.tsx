import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router";
import Checkbox from "../../components/primitives/checkboxes/checkbox.tsx";
import Content from "../../content.ts";
import { AuthPrimaryButton } from "../../components/primitives/buttons/auth-primary-button.tsx";
import { TextInput } from "../../components/primitives/text-inputs/text-input.tsx";
import { AuthLayout } from "../../layouts/auth-layout.tsx";
import { useUserStore } from "../../store/user-store.ts";
import { useAuthStore } from "../../store/auth-store.ts";
import * as Sentry from "@sentry/react";

export function RegisterPage() {
	const { completeRegistration } = useUserStore();
	const { logout } = useAuthStore();
	const navigate = useNavigate();
	const [hasAcceptedPrivacy, setHasAcceptedPrivacy] = useState(false);
	const [isFormValid, setIsFormValid] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);

	// "required" also accepts names made of spaces only
	const updateIsFormValid = (form: HTMLFormElement) => {
		const hasNames = [form.firstName, form.lastName].every(
			(input: HTMLInputElement) => input.value.trim() !== "",
		);
		setIsFormValid(hasNames && form.checkValidity());
	};

	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		const firstName = event.currentTarget.firstName.value.trim();
		const lastName = event.currentTarget.lastName.value.trim();

		setIsSubmitting(true);

		Sentry.startSpan(
			{
				name: "Registration Form Submitted",
				op: "user.registration.submit",
			},
			async () => {
				const { error } = await completeRegistration({
					first_name: firstName,
					last_name: lastName,
				});

				setIsSubmitting(false);

				if (!error) {
					navigate("/");
				}
			},
		);
	};

	return (
		<AuthLayout>
			<div className="flex flex-col min-h-[100svh] h-full w-full justify-center items-center bg-hellblau-30 px-5 py-12 md:py-[100px]">
				<div className="flex flex-col gap-10 border max-w-[580px] w-full border-dunkelblau-100 p-5 md:p-7 rounded-3px bg-white text-dunkelblau-100">
					<div className="flex flex-col gap-4">
						<h1 className="text-3xl leading-9 md:text-4xl md:leading-10 font-bold">
							{Content["registerPage.h1"]}
						</h1>
						<p className="text-lg leading-7 md:text-xl md:leading-8">
							{Content["registerPage.intro"]}
						</p>
					</div>

					<form
						className="flex flex-col gap-10"
						onSubmit={handleSubmit}
						onInput={(event) => updateIsFormValid(event.currentTarget)}
						onChange={(event) => updateIsFormValid(event.currentTarget)}
					>
						<div className="flex flex-col gap-6">
							<div className="flex flex-col gap-1.5">
								<label
									htmlFor="firstName"
									className="text-sm leading-5 font-bold"
								>
									{Content["registerPage.firstNameLabel"]}
								</label>
								<TextInput
									id="firstName"
									placeholder={Content["registerPage.firstNamePlaceholder"]}
									className="h-12 !px-3 !border-dunkelblau-50 placeholder:text-dunkelblau-65"
								/>
							</div>

							<div className="flex flex-col gap-1.5">
								<label
									htmlFor="lastName"
									className="text-sm leading-5 font-bold"
								>
									{Content["registerPage.lastNameLabel"]}
								</label>
								<TextInput
									id="lastName"
									placeholder={Content["registerPage.lastNamePlaceholder"]}
									className="h-12 !px-3 !border-dunkelblau-50 placeholder:text-dunkelblau-65"
								/>
							</div>

							<Checkbox
								id="has-accepted-privacy"
								checked={hasAcceptedPrivacy}
								onChange={setHasAcceptedPrivacy}
								required={true}
							>
								<span className="text-sm leading-5 font-bold">
									{Content["registerPage.privacyText.p1"]}{" "}
									<a
										href={Content["footer.privacy.link"]}
										className="underline hover:no-underline rounded-3px focus-visible:outline-default"
										target="_blank"
									>
										{Content["registerPage.privacyLink.label"]}
									</a>{" "}
									{Content["registerPage.privacyText.p2"]}{" "}
									<a
										href={Content["footer.termsOfUse.link"]}
										className="underline hover:no-underline rounded-3px focus-visible:outline-default"
										target="_blank"
									>
										{Content["registerPage.termsOfUse.label"]}
									</a>
								</span>
							</Checkbox>
						</div>
						<AuthPrimaryButton
							type="submit"
							disabled={!isFormValid || isSubmitting}
						>
							{Content["registerPage.submitButton"]}
						</AuthPrimaryButton>
					</form>

					<p className="text-lg leading-7 text-center">
						{Content["registerPage.wrongAccount.question"]}{" "}
						<button
							type="button"
							onClick={logout}
							className="font-bold underline hover:no-underline focus-visible:outline-default rounded-3px"
						>
							{Content["registerPage.wrongAccount.logoutButton"]}
						</button>
					</p>
				</div>
			</div>
		</AuthLayout>
	);
}
