import { type FormEvent, useState } from "react";
import Content from "../../../content.ts";
import { useAuthStore } from "../../../store/auth-store.ts";
import { EmailInput } from "../../primitives/text-inputs/email-input.tsx";
import { SubmitButton } from "../../primitives/buttons/submit-button.tsx";
import { ChangeEmailDialog } from "./change-email-dialog.tsx";

const emailInUseError =
	"A user with this email address has already been registered";

export function ChangeEmailForm() {
	const { session, updateEmail } = useAuthStore();
	const [hasChanges, setHasChanges] = useState(false);
	const [resetKey, setResetKey] = useState(0);
	const [changeMailError, setChangeMailError] = useState<string | null>(null);
	const [isValid, setIsValid] = useState(true);

	if (!session) {
		return null;
	}

	const { email: originalEmail, new_email: requestedNewEmail } = session.user;

	const handleFormChange = (event: FormEvent<HTMLFormElement>) => {
		const form = event.currentTarget;
		const emailValue = form.email.value;

		const hasFormChanges = emailValue !== originalEmail;

		setHasChanges(hasFormChanges);
		setIsValid(form.checkValidity());
	};

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		const newEmail = event.currentTarget.email.value;
		const { error } = await updateEmail(newEmail);

		if (error) {
			setChangeMailError(error.message);
			return;
		}

		if (!error) {
			setResetKey((prev) => prev + 1);
			setChangeMailError(null);
			(
				document.getElementById(`change-email-dialog`) as HTMLDialogElement
			).showModal();
		}
	};

	return (
		<div className="flex flex-col gap-y-4">
			<h3 className="text-base leading-6 font-semibold">
				{Content["profile.changeEmailForm.title"]}
			</h3>

			{requestedNewEmail && (
				<div className="text-dunkelblau-60 text-sm">
					{Content["profile.changeEmailForm.hint.p1"]}{" "}
					<span className="font-semibold">{requestedNewEmail}</span>{" "}
					{Content["profile.changeEmailForm.hint.p2"]}
					<br />
					{Content["profile.changeEmailForm.hint.p3"]}{" "}
					<span className="font-semibold">{requestedNewEmail}</span>{" "}
					{Content["profile.changeEmailForm.hint.p4"]}
				</div>
			)}
			<form
				className="flex flex-col"
				onSubmit={handleSubmit}
				onChange={handleFormChange}
			>
				<label
					htmlFor="email"
					className="flex flex-col gap-y-1 text-sm md:text-base grow"
				>
					<div className="flex gap-1 items-center">
						{Content["profile.changeEmailForm.label"]}
						<span>{Content["profile.requiredField"]}</span>
					</div>
					<EmailInput
						key={resetKey}
						id="email"
						defaultValue={originalEmail || ""}
						className="placeholder:text-dunkelblau-200"
					/>
					{changeMailError && (
						<div className="text-berlin-rot mt-1.5 text-sm" role="alert">
							{changeMailError === emailInUseError
								? Content["profile.changeEmailForm.emailInUseError"]
								: Content["profile.changeEmailForm.error"]}
						</div>
					)}
				</label>
				<SubmitButton
					disabled={!hasChanges || !isValid}
					className="mt-4 self-end"
				>
					{Content["profile.changeEmailForm.submitButton"]}
				</SubmitButton>
			</form>
			<ChangeEmailDialog />
		</div>
	);
}
