import React, { useRef, useState } from "react";
import { DefaultDialog } from "../../primitives/dialogs/default-dialog";
import { useDocumentsListStore } from "../../../store/use-documents-list-store.ts";
import { useToastStore } from "../../../store/use-toast-store.ts";
import { TertiaryButton } from "../../primitives/buttons/tertiary-button.tsx";
import { PrimaryButton } from "../../primitives/buttons/primary-button.tsx";
import { getFileExtension } from "../document-list/list-item/utils/get-file-extension.ts";
import Content from "../../../content.ts";

export function showRenameItemDialog(dialogId: string) {
	(document.getElementById(dialogId) as HTMLDialogElement).showModal();
}

export function hideRenameItemDialog(dialogId: string) {
	(document.getElementById(dialogId) as HTMLDialogElement).close();
}

interface RenameItemDialogProps {
	id: string;
	title: string;
	item: { id: number; name: string } | null;
	onRename: (id: number, newName: string) => Promise<Error | null>;
	failureMessage: string;
	successMessage?: string;
	maxLength?: number;
	getNameError?: (newName: string) => string;
	normalizeName?: (name: string) => string;
	selectBaseNameOnly?: boolean;
}

export const RenameItemDialog: React.FC<RenameItemDialogProps> = ({
	id,
	title,
	item,
	onRename,
	failureMessage,
	successMessage,
	maxLength,
	getNameError,
	normalizeName = (name) => name,
	selectBaseNameOnly = false,
}) => {
	const { setSingleItemSelectedForAction } = useDocumentsListStore();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const hasSelectedInitialNameRef = useRef(false);
	const submissionRef = useRef(0);

	const validateName = (newName: string): string => {
		if (!newName) {
			return Content["renameItemDialog.error.empty"];
		}
		if (maxLength && newName.length > maxLength) {
			return Content["renameItemDialog.error.tooLong"].replace(
				"{maxLength}",
				String(maxLength),
			);
		}
		return getNameError?.(newName) ?? "";
	};

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		if (!item || isSubmitting) {
			return;
		}

		const input = event.currentTarget.itemName as HTMLInputElement;
		const newName = normalizeName(input.value.trim());

		// Checked before validation so an unchanged name that predates the rules can still be submitted
		if (newName === item.name) {
			hideRenameItemDialog(id);
			return;
		}

		const nameError = validateName(newName);
		input.setCustomValidity(nameError);
		if (nameError) {
			input.reportValidity();
			return;
		}

		const submission = ++submissionRef.current;
		setIsSubmitting(true);
		const error = await onRename(item.id, newName);
		if (submission !== submissionRef.current) {
			return;
		}
		setIsSubmitting(false);

		if (error) {
			useToastStore.getState().addError(failureMessage);
			return;
		}

		hideRenameItemDialog(id);
		if (successMessage) {
			useToastStore.getState().addSuccess(successMessage);
		}
	};

	return (
		<DefaultDialog
			id={id}
			className="w-full md:w-[29rem] gap-y-4 p-5"
			afterClose={() => {
				submissionRef.current++;
				setIsSubmitting(false);
				hasSelectedInitialNameRef.current = false;
				setSingleItemSelectedForAction(null);
			}}
		>
			<form
				className="flex flex-col gap-y-6"
				onSubmit={handleSubmit}
				noValidate
			>
				<label htmlFor={`${id}-input`} className="flex flex-col gap-y-1">
					<span className="text-dunkelblau-100 font-bold text-lg">{title}</span>
					<input
						key={item?.id}
						className="w-full px-4 py-2 rounded-3px border border-dunkelblau-80 focus-visible:outline-default"
						id={`${id}-input`}
						name="itemName"
						type="text"
						defaultValue={item?.name}
						maxLength={maxLength}
						autoFocus
						onInput={({ currentTarget }) => currentTarget.setCustomValidity("")}
						onFocus={({ currentTarget }) => {
							if (hasSelectedInitialNameRef.current) {
								return;
							}
							hasSelectedInitialNameRef.current = true;

							const { value } = currentTarget;
							const selectionEnd = selectBaseNameOnly
								? value.length - getFileExtension(value).length
								: value.length;
							currentTarget.setSelectionRange(0, selectionEnd);
						}}
					/>
				</label>
				<div className="flex flex-row justify-end gap-3">
					<TertiaryButton
						type="button"
						onClick={() => hideRenameItemDialog(id)}
					>
						{Content["renameItemDialog.cancel"]}
					</TertiaryButton>
					<PrimaryButton type="submit" disabled={isSubmitting}>
						{Content["renameItemDialog.rename"]}
					</PrimaryButton>
				</div>
			</form>
		</DefaultDialog>
	);
};
