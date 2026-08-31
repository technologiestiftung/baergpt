import { type FormEvent, useState, useRef } from "react";
import { DefaultDialog } from "../../primitives/dialogs/default-dialog.tsx";
import { TertiaryButton } from "../../primitives/buttons/tertiary-button.tsx";
import Content from "../../../content.ts";
import { useUserStore } from "../../../store/user-store.ts";
import { useAuthStore } from "../../../store/auth-store.ts";
import { useNavigate } from "react-router";
import { TextInput } from "../../primitives/text-inputs/text-input.tsx";
import { WarningButton } from "../../primitives/buttons/warning-button.tsx";

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
	const [confirmationError, setConfirmationError] = useState<string | null>(
		null,
	);

	const formref = useRef<HTMLFormElement | null>(null);

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		const accountEmail = useAuthStore.getState().session?.user.email ?? "";
		const enteredEmail = event.currentTarget.deleteAccountConfirmation.value;

		// Passwordless accounts confirm the destructive action by re-typing the
		// account's own email address instead of a password.
		const isConfirmed =
			enteredEmail.trim().toLowerCase() === accountEmail.toLowerCase();
		if (!isConfirmed) {
			setConfirmationError(
				Content["profile.deleteAccount.dialog.emailCheck.error"],
			);
			return;
		}

		const { error } = await deleteAccount();
		if (error) {
			return;
		}

		navigate("/account-deleted/", { replace: true });
	};

	const handleHideDeleteDialog = () => {
		hideDeleteDialog();
		formref.current?.reset();
		setConfirmationError(null);
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
					<label
						htmlFor="deleteAccountConfirmation"
						className="flex flex-col gap-2"
					>
						<span className="text-sm leading-5 font-normal">
							{Content["profile.deleteAccount.dialog.emailCheck.label"]}
						</span>
						<TextInput id="deleteAccountConfirmation" />
						{confirmationError && (
							<div className="text-berlin-rot text-sm mt-1">
								{confirmationError}
							</div>
						)}
					</label>
					<div className="flex flex-row justify-end gap-4">
						<TertiaryButton type="button" onClick={handleHideDeleteDialog}>
							{Content["profile.deleteAccount.dialog.cancel"]}
						</TertiaryButton>
						<WarningButton
							type="submit"
							ariaLabel={Content["profile.deleteAccount.button"]}
							testId="confirm-delete-account-button"
						>
							{Content["profile.deleteAccount.button"]}
						</WarningButton>
					</div>
				</form>
			</div>
		</DefaultDialog>
	);
};
