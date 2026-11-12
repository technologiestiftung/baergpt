import React, { type FormEvent } from "react";
import { useChatsStore } from "../../../../store/use-chats-store";
import { useHistorySelectionStore } from "../../../../store/use-history-selection-store";
import { DefaultDialog } from "../../../primitives/dialogs/default-dialog";
import { TertiaryButton } from "../../../primitives/buttons/tertiary-button";
import { PrimaryButton } from "../../../primitives/buttons/primary-button";
import Content from "../../../../content";
import { useCurrentChatIdStore } from "../../../../store/current-chat-id-store";
import { captureError } from "../../../../monitoring/capture-error";
import { useToastStore } from "../../../../store/use-toast-store";

const deleteSelectedHistoryEntriesDialogId =
	"delete-selected-history-entries-dialog";

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
	const { currentChatId, setCurrentChatId } = useCurrentChatIdStore();

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

		if (currentChatId !== null && selectedChatIds.includes(currentChatId)) {
			setCurrentChatId(null);
		}

		clearSelection();
	};

	return (
		<DefaultDialog
			id={deleteSelectedHistoryEntriesDialogId}
			className="w-full md:w-[29rem] gap-y-4 p-5"
		>
			<form className="flex flex-col gap-y-6" onSubmit={handleSubmit}>
				<p className="text-dunkelblau-100 font-bold text-lg">
					{Content["deleteSelectedHistoryEntriesDialog.title"].replace(
						"{count}",
						count,
					)}
				</p>
				<p>
					{Content["deleteSelectedHistoryEntriesDialog.confirmation"].replace(
						"{count}",
						count,
					)}
				</p>

				<div className="flex flex-row justify-end gap-4 mt-4">
					<TertiaryButton
						type="button"
						onClick={hideDeleteSelectedHistoryEntriesDialog}
					>
						{Content["deleteSelectedHistoryEntriesDialog.cancel"]}
					</TertiaryButton>
					<PrimaryButton type="submit">
						{Content["deleteSelectedHistoryEntriesDialog.delete"]}
					</PrimaryButton>
				</div>
			</form>
		</DefaultDialog>
	);
};
