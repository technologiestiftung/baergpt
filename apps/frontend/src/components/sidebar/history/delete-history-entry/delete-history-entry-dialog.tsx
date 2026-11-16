import React, { type FormEvent } from "react";
import { useChatsStore } from "../../../../store/use-chats-store";
import { useHistoryEntryDeleteStore } from "../../../../store/use-history-entry-delete-store";
import { DefaultDialog } from "../../../primitives/dialogs/default-dialog";
import { TertiaryButton } from "../../../primitives/buttons/tertiary-button";
import { PrimaryButton } from "../../../primitives/buttons/primary-button";
import Content from "../../../../content";
import { captureError } from "../../../../monitoring/capture-error";
import { useToastStore } from "../../../../store/use-toast-store";

const deleteHistoryEntryDialogId = "delete-history-entry-dialog";

export function showDeleteHistoryEntryDialog() {
	(
		document.getElementById(deleteHistoryEntryDialogId) as HTMLDialogElement
	).showModal();
}

export function hideDeleteHistoryEntryDialog() {
	(
		document.getElementById(deleteHistoryEntryDialogId) as HTMLDialogElement
	).close();
}

export const DeleteHistoryEntryDialog: React.FC = () => {
	const { deleteChats } = useChatsStore();
	const { historyEntryToDeleteId, historyEntryToDeleteName } =
		useHistoryEntryDeleteStore();

	const truncatedHistoryEntryToDeleteName =
		historyEntryToDeleteName.length > 80
			? `${historyEntryToDeleteName.slice(0, 80)}…`
			: historyEntryToDeleteName;

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		if (!historyEntryToDeleteId) {
			return;
		}

		hideDeleteHistoryEntryDialog();
		deleteChats([historyEntryToDeleteId]).catch((error) => {
			captureError(error);
			useToastStore
				.getState()
				.addError(Content["deleteHistoryEntryDialog.error"]);
		});
	};

	return (
		<DefaultDialog
			id={deleteHistoryEntryDialogId}
			className="w-full md:w-[29rem] gap-y-4 p-5"
		>
			<form className="flex flex-col gap-y-6" onSubmit={handleSubmit}>
				<p className="text-dunkelblau-100 font-bold text-lg">
					{Content["deleteHistoryEntryDialog.title"]}
				</p>
				<p>
					{Content["deleteHistoryEntryDialog.confirmation.p1"]}{" "}
					<span className="underline">{truncatedHistoryEntryToDeleteName}</span>{" "}
					{Content["deleteHistoryEntryDialog.confirmation.p2"]}
				</p>

				<div className="flex flex-row justify-end gap-4 mt-4">
					<TertiaryButton type="button" onClick={hideDeleteHistoryEntryDialog}>
						{Content["deleteHistoryEntryDialog.cancel"]}
					</TertiaryButton>
					<PrimaryButton type="submit">
						{Content["deleteHistoryEntryDialog.delete"]}
					</PrimaryButton>
				</div>
			</form>
		</DefaultDialog>
	);
};
