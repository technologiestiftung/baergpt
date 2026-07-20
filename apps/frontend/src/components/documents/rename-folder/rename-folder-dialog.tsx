import React from "react";
import { DefaultDialog } from "../../primitives/dialogs/default-dialog";
import { useDocumentsListStore } from "../../../store/use-documents-list-store.ts";
import { useUserFolderStore } from "../../../store/use-user-folder-store.ts";
import { isUserFolder } from "../document-list/list-item/utils/is-user-folder.ts";
import { TertiaryButton } from "../../primitives/buttons/tertiary-button.tsx";
import { PrimaryButton } from "../../primitives/buttons/primary-button.tsx";
import Content from "../../../content.ts";

const renameFolderDialogId = "rename-folder-dialog";

export function showRenameFolderDialog() {
	(
		document.getElementById(renameFolderDialogId) as HTMLDialogElement
	).showModal();
}

export function hideRenameFolderDialog() {
	(document.getElementById(renameFolderDialogId) as HTMLDialogElement).close();
}

export const RenameFolderDialog: React.FC = () => {
	const { singleItemSelectedForAction, setSingleItemSelectedForAction } =
		useDocumentsListStore();

	const folder = isUserFolder(singleItemSelectedForAction)
		? singleItemSelectedForAction
		: null;

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		if (!folder) {
			return;
		}

		const newName = event.currentTarget.folderName.value.trim();

		// Keep the dialog open on an empty name so the user can correct it
		if (!newName) {
			return;
		}

		if (newName === folder.name) {
			hideRenameFolderDialog();
			return;
		}

		const error = await useUserFolderStore
			.getState()
			.renameUserFolder(folder.id, newName);

		// Close only once the rename succeeds; keep it open on failure to retry
		if (!error) {
			hideRenameFolderDialog();
		}
	};

	return (
		<DefaultDialog
			id={renameFolderDialogId}
			className="w-full md:w-[29rem] gap-y-4 p-5"
			// Clears the selection however the dialog closes: submit, cancel, Esc or backdrop click
			afterClose={() => setSingleItemSelectedForAction(null)}
		>
			<form className="flex flex-col gap-y-6" onSubmit={handleSubmit}>
				<label htmlFor="renameFolderName" className="flex flex-col gap-y-1">
					<span className="text-dunkelblau-100 font-bold text-lg">
						{Content["renameFolderDialog.title"]}
					</span>
					<input
						key={folder?.id}
						className="w-full px-4 py-2 rounded-3px border border-dunkelblau-80 focus-visible:outline-default"
						id="renameFolderName"
						name="folderName"
						type="text"
						defaultValue={folder?.name}
						autoFocus
						onFocus={({ currentTarget }) => currentTarget.select()}
					/>
				</label>
				<div className="flex flex-row justify-end gap-3">
					<TertiaryButton type="button" onClick={hideRenameFolderDialog}>
						{Content["renameFolderDialog.cancel"]}
					</TertiaryButton>
					<PrimaryButton type="submit">
						{Content["renameFolderDialog.rename"]}
					</PrimaryButton>
				</div>
			</form>
		</DefaultDialog>
	);
};
