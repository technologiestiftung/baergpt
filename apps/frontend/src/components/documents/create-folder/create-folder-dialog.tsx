import React from "react";
import { DefaultDialog } from "../../primitives/dialogs/default-dialog";
import { useFolderStore } from "../../../store/folder-store.ts";
import { TertiaryButton } from "../../primitives/buttons/tertiary-button.tsx";
import { PrimaryButton } from "../../primitives/buttons/primary-button.tsx";
import Content from "../../../content.ts";

const newFolderDialogId = "new-folder-dialog";

export function showCreateFolderDialog() {
	(document.getElementById(newFolderDialogId) as HTMLDialogElement).showModal();
}

export function hideCreateFolderDialog() {
	(document.getElementById(newFolderDialogId) as HTMLDialogElement).close();
}

export const CreateFolderDialog: React.FC = () => {
	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const folderName = event.currentTarget.folderName.value.trim();
		event.currentTarget.reset();

		if (!folderName) {
			return;
		}

		useFolderStore.getState().createFolder(folderName);
		hideCreateFolderDialog();
	};

	return (
		<DefaultDialog
			id={newFolderDialogId}
			className="w-full md:w-[29rem] gap-y-4 p-5"
		>
			<form className="flex flex-col gap-y-6" onSubmit={handleSubmit}>
				<label htmlFor="folderName" className="flex flex-col gap-y-1">
					<span className="text-dunkelblau-100 font-bold text-lg">
						{Content["createFolderDialog.title"]}
					</span>
					<input
						className="w-full px-4 py-2 rounded-3px border border-dunkelblau-80 focus-visible:outline-default"
						id="folderName"
						name="folderName"
						type="text"
						placeholder={Content["createFolderDialog.folderName"]}
					/>
				</label>
				<div className="flex flex-row justify-end gap-4">
					<TertiaryButton type="button" onClick={hideCreateFolderDialog}>
						{Content["createFolderDialog.cancel"]}
					</TertiaryButton>
					<PrimaryButton type="submit">
						{Content["createFolderDialog.create"]}
					</PrimaryButton>
				</div>
			</form>
		</DefaultDialog>
	);
};
