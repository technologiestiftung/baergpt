import React, { type FormEvent } from "react";
import { useChatsStore } from "../../../../store/use-chats-store";
import { useHistorySelectionStore } from "../../../../store/use-history-selection-store";
import { DefaultDialog } from "../../../primitives/dialogs/default-dialog";
import { TertiaryButton } from "../../../primitives/buttons/tertiary-button";
import { WarningButton } from "../../../primitives/buttons/warning-button";
import Content from "../../../../content";
import { captureError } from "../../../../monitoring/capture-error";
import { useToastStore } from "../../../../store/use-toast-store";

const deleteSelectedHistoryEntriesDialogId =
	"delete-selected-history-entries-dialog";
const deleteSelectedHistoryEntriesDialogTitleId = `${deleteSelectedHistoryEntriesDialogId}-title`;

export function showDeleteSelectedHistoryEntriesDialog() {
	(
		document.getElementById(
			deleteSelectedHistoryEntriesDialogId,
		) as HTMLDialogElement
	).showModal();
}

export function hideDeleteSelectedHistoryEntriesDialog() {
	(
		document.getElementById(
			deleteSelectedHistoryEntriesDialogId,
		) as HTMLDialogElement
	).close();
}

export const DeleteSelectedHistoryEntriesDialog: React.FC = () => {
	const { deleteChats } = useChatsStore();
	const { selectedChatIds, clearSelection } = useHistorySelectionStore();

	const count = String(selectedChatIds.length);

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		if (selectedChatIds.length === 0) {
			return;
		}

		hideDeleteSelectedHistoryEntriesDialog();
		deleteChats(selectedChatIds).catch((error) => {
			captureError(error);
			useToastStore
				.getState()
				.addError(Content["deleteSelectedHistoryEntriesDialog.error"]);
		});

		clearSelection();
	};

	return (
		<DefaultDialog
			id={deleteSelectedHistoryEntriesDialogId}
			ariaLabelledBy={deleteSelectedHistoryEntriesDialogTitleId}
			className="w-full md:w-[29rem] gap-y-4 p-5"
		>
			<form className="flex flex-col gap-y-1" onSubmit={handleSubmit}>
				<p
					id={deleteSelectedHistoryEntriesDialogTitleId}
					className="text-dunkelblau-100 font-bold text-lg leading-7"
				>
					{Content["deleteSelectedHistoryEntriesDialog.title"].replace(
						"{count}",
						count,
					)}
				</p>
				<p className="text-dunkelblau-100 text-lg leading-7 font-normal">
					{Content["deleteSelectedHistoryEntriesDialog.confirmation"].replace(
						"{count}",
						count,
					)}
				</p>

				<div className="flex flex-row justify-end gap-3 mt-6">
					<TertiaryButton
						type="button"
						onClick={hideDeleteSelectedHistoryEntriesDialog}
					>
						{Content["deleteSelectedHistoryEntriesDialog.cancel"]}
					</TertiaryButton>
					<WarningButton type="submit">
						{Content["deleteSelectedHistoryEntriesDialog.delete"]}
					</WarningButton>
				</div>
			</form>
		</DefaultDialog>
	);
};
