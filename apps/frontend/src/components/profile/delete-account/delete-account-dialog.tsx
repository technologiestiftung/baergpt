import { FormEvent, useState, useRef } from "react";
import { DefaultDialog } from "../../primitives/dialogs/default-dialog.tsx";
import { TertiaryButton } from "../../primitives/buttons/tertiary-button.tsx";
import Content from "../../../content.ts";
import { useUserStore } from "../../../store/user-store.ts";
import { useNavigate } from "react-router-dom";
import { PasswordInput } from "../../primitives/text-inputs/password-input.tsx";
import { verifyPassword } from "../../../api/auth/verify-password.ts";

const deleteAccountDialogId = "delete-account-dialog";

export function showDeleteAccountDialog() {
	(
		document.getElementById(deleteAccountDialogId) as HTMLDialogElement
	).showModal();
}

export function hideDeleteDialog() {
	(document.getElementById(deleteAccountDialogId) as HTMLDialogElement).close();
}

export const DeleteAccountDialog = () => {
	const { deleteAccount } = useUserStore.getState();
	const navigate = useNavigate();
	const [currentPasswordError, setCurrentPasswordError] = useState<
		string | null
	>(null);

	const formref = useRef<HTMLFormElement | null>(null);

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		const currentPassword = event.currentTarget.currentPasswordValidation.value;

		// Verify current password
		const verifyResult = await verifyPassword(currentPassword);
		if (verifyResult.error) {
			return;
		}

		const isCurrentPasswordValid = verifyResult.data;
		if (!isCurrentPasswordValid) {
			setCurrentPasswordError(Content["form.validation.password.wrong.error"]);
			return;
		}

		await deleteAccount();

		navigate("/account-deleted/", { replace: true });
	};

	const handleHideDeleteDialog = () => {
		hideDeleteDialog();
		formref.current?.reset();
		setCurrentPasswordError(null);
	};

	return (
		<DefaultDialog
			id={deleteAccountDialogId}
			className="w-full md:w-[29rem] text-dunkelblau-100 p-5"
		>
			<div className="flex flex-col gap-6">
				<div>
					<h2 className="text-lg leading-7 font-semibold">
						{Content["profile.deleteAccount.dialog.title"]}
					</h2>
					<p className="text-sm leading-5 font-normal">
						{Content["profile.deleteAccount.dialog.description"]}
					</p>
				</div>
				<form
					ref={formref}
					className="flex flex-col gap-6"
					onSubmit={handleSubmit}
				>
					<label htmlFor="password-validation" className="flex flex-col gap-2">
						<span className="text-sm leading-5 font-normal">
							{Content["profile.deleteAccount.dialog.passwordCheck.label"]}
						</span>
						<PasswordInput id="currentPasswordValidation" autoComplete="off" />
						{currentPasswordError && (
							<div className="text-berlin-rot text-sm mt-1">
								{currentPasswordError}
							</div>
						)}
					</label>
					<div className="flex flex-row justify-end gap-4">
						<TertiaryButton type="button" onClick={handleHideDeleteDialog}>
							{Content["profile.deleteAccount.dialog.cancel"]}
						</TertiaryButton>
						<button
							id="confirm-delete-account-button"
							className="p-2 rounded-[3px] w-fit flex-shrink-0 self-end md:self-center text-white text-sm leading-5 font-normal bg-warning-100 hover:bg-warning-85 focus-visible:outline-default"
							type="submit"
							aria-label={Content["profile.deleteAccount.button"]}
						>
							{Content["profile.deleteAccount.button"]}
						</button>
					</div>
				</form>
			</div>
		</DefaultDialog>
	);
};
