import { type FormEvent, useState } from "react";
import Content from "../../../content.ts";
import { PasswordInput } from "../../primitives/text-inputs/password-input.tsx";
import { SubmitButton } from "../../primitives/buttons/submit-button.tsx";
import { verifyPassword } from "../../../api/auth/verify-password.ts";
import { updatePassword } from "../../../api/auth/update-password.ts";
import { useToastStore } from "../../../store/use-toast-store.ts";

export function ChangePasswordForm() {
	const [hasChanges, setHasChanges] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	/**
	 * You might wonder why we use two states here.
	 * `formError` is to save error messages on the form level (e.g. "Passwords do not match").
	 * `hasInputError` is to know if there is an error on the input level (e.g. "Field is required").
	 * We need both to be able to enable/disable the submit button correctly.
	 */
	const [formError, setFormError] = useState("");
	const [hasInputError, setHasInputError] = useState(false);

	const { addSuccess } = useToastStore();

	const handleFormChange = (event: FormEvent<HTMLFormElement>) => {
		const form = event.currentTarget;
		const currentPassword = form.currentPassword;
		const newPassword = form.password;
		const repeatPassword = form.repeatPassword;

		const currentPasswordValue = currentPassword.value;
		const newPasswordValue = newPassword.value;
		const passwordRepeatValue = repeatPassword.value;

		// Reset custom validity for currentPassword
		currentPassword.setCustomValidity("");

		const isCurrentPasswordValid = currentPassword.validity.valid;
		const isNewPasswordValid = newPassword.validity.valid;
		const isRepeatPasswordValid = repeatPassword.validity.valid;

		const hasFormChanges =
			currentPasswordValue.length > 0 &&
			newPasswordValue.length > 0 &&
			passwordRepeatValue.length > 0;

		setHasChanges(hasFormChanges);

		if (
			!isCurrentPasswordValid ||
			!isNewPasswordValid ||
			!isRepeatPasswordValid
		) {
			setHasInputError(true);
			return;
		}

		if (
			isCurrentPasswordValid &&
			isNewPasswordValid &&
			isRepeatPasswordValid &&
			newPasswordValue &&
			passwordRepeatValue &&
			newPasswordValue !== passwordRepeatValue
		) {
			setFormError(
				Content["form.validation.password.repeatPasswordShouldMatch.error"],
			);
			return;
		}

		if (
			currentPasswordValue &&
			newPasswordValue &&
			currentPasswordValue === newPasswordValue
		) {
			setFormError(Content["form.validation.password.shouldBeDifferent.error"]);
			return;
		}

		setFormError("");
		setHasInputError(false);
	};

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setIsLoading(true);

		const form = event.currentTarget;

		const currentPassword = form.currentPassword.value;
		const newPassword = form.password.value;

		if (currentPassword === newPassword) {
			setFormError(Content["form.validation.password.shouldBeDifferent.error"]);
			setIsLoading(false);
			return;
		}

		const { data: isCurrentPasswordValid, error: verifyPasswordError } =
			await verifyPassword(currentPassword);

		if (verifyPasswordError) {
			setFormError(Content["profile.passwordUpdateError"]);
			setIsLoading(false);
			return;
		}

		if (!isCurrentPasswordValid) {
			form.currentPassword.setCustomValidity(
				Content["form.validation.password.wrong.error"],
			);
			/**
			 * We need to report the validity so the child component's
			 * invalid event will be triggered.
			 */
			form.reportValidity();
			setIsLoading(false);
			return;
		}

		const { error: updatePasswordError } = await updatePassword(newPassword);

		if (updatePasswordError) {
			setFormError(Content["profile.passwordUpdateError"]);
			setIsLoading(false);
			return;
		}

		addSuccess(Content["profile.passwordUpdateSuccess"]);
		form.reset();
		setHasChanges(false);
		setIsLoading(false);
	};

	const hasError = formError !== "";

	return (
		<>
			<div className="flex flex-col gap-4">
				<h3 className="text-base leading-6 font-semibold">
					{Content["profile.changePasswordTitle"]}
				</h3>
				<form
					className="flex flex-col"
					onSubmit={handleSubmit}
					onChange={handleFormChange}
				>
					<div className="flex flex-col gap-4">
						<label
							htmlFor="currentPassword"
							className="flex flex-col gap-y-1 text-sm md:text-base"
						>
							{Content["profile.currentPasswordLabel"]}
							<PasswordInput id="currentPassword" autoComplete="off" />
						</label>
					</div>
					<div className="grid md:grid-cols-2 gap-4 md:gap-6 w-full mt-8">
						<label
							htmlFor="password"
							className="flex flex-col gap-y-1 text-sm md:text-base"
						>
							{Content["profile.passwordLabel"]}
							<PasswordInput
								id="password"
								autoComplete="new-password"
								minLength={10}
							/>
						</label>

						<label
							htmlFor="repeatPassword"
							className="flex flex-col gap-y-1 text-sm md:text-base"
						>
							{Content["profile.passwordRepeatLabel"]}
							<PasswordInput
								id="repeatPassword"
								autoComplete="new-password"
								minLength={10}
							/>
						</label>
					</div>

					{hasError && (
						<div className="text-berlin-rot text-sm mt-2">{formError}</div>
					)}

					<SubmitButton
						disabled={!hasChanges || isLoading || !!formError || hasInputError}
						className="mt-4 self-end"
					>
						{Content["profile.changePasswordButton"]}
					</SubmitButton>
				</form>
			</div>
		</>
	);
}
