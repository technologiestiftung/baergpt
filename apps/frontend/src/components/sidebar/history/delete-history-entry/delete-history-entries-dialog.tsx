import React, { type FormEvent, type ReactNode, useRef, useState } from "react";
import { useChatsStore } from "../../../../store/use-chats-store";
import { useHistorySelectionStore } from "../../../../store/use-history-selection-store";
import {
	type DeleteHistoryEntriesTarget,
	useDeleteHistoryEntriesDialogStore,
} from "../../../../store/use-delete-history-entries-dialog-store";
import { DefaultDialog } from "../../../primitives/dialogs/default-dialog";
import { TertiaryButton } from "../../../primitives/buttons/tertiary-button";
import { WarningButton } from "../../../primitives/buttons/warning-button";
import { LoadingSpinnerIcon } from "../../../primitives/icons/loading-spinner-icon.tsx";
import Content from "../../../../content";
import { captureError } from "../../../../monitoring/capture-error";
import { useToastStore } from "../../../../store/use-toast-store";

const deleteHistoryEntriesDialogId = "delete-history-entries-dialog";
const deleteHistoryEntriesDialogTitleId = `${deleteHistoryEntriesDialogId}-title`;
const maxChatNameLength = 80;

function showDeleteHistoryEntriesDialog(target: DeleteHistoryEntriesTarget) {
	useDeleteHistoryEntriesDialogStore.getState().setTarget(target);
	(
		document.getElementById(deleteHistoryEntriesDialogId) as HTMLDialogElement
	).showModal();
}

export function showDeleteHistoryEntryDialog(chatId: number, chatName: string) {
	showDeleteHistoryEntriesDialog({ type: "single", chatId, chatName });
}

export function showDeleteSelectedHistoryEntriesDialog() {
	showDeleteHistoryEntriesDialog({ type: "selected" });
}

export function showDeleteAllChatsDialog() {
	showDeleteHistoryEntriesDialog({ type: "all" });
}

export function hideDeleteHistoryEntriesDialog() {
	(
		document.getElementById(deleteHistoryEntriesDialogId) as HTMLDialogElement
	).close();
}

function formatChatName(chatName: string) {
	const sanitized = chatName.replace(/[#`>*]/g, "");
	return sanitized.length > maxChatNameLength
		? `${sanitized.slice(0, maxChatNameLength)}…`
		: sanitized;
}

export const DeleteHistoryEntriesDialog: React.FC = () => {
	const { deleteChats, deleteAllChats } = useChatsStore();
	const { selectedChatIds, clearSelection } = useHistorySelectionStore();
	const { target } = useDeleteHistoryEntriesDialogStore();
	const cancelButtonRef = useRef<HTMLButtonElement>(null);
	const [isDeleting, setIsDeleting] = useState(false);

	const count = String(selectedChatIds.length);

	const handleDeleteError = (errorMessage: string) => (error: unknown) => {
		captureError(error);
		useToastStore.getState().addError(errorMessage);
	};

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		if (target.type === "selected" && selectedChatIds.length === 0) {
			return;
		}

		setIsDeleting(true);

		try {
			if (target.type === "single") {
				await deleteChats([target.chatId]);
			} else if (target.type === "all") {
				await deleteAllChats();
			} else {
				await deleteChats(selectedChatIds);
			}

			if (target.type !== "single") {
				clearSelection();
			}
			hideDeleteHistoryEntriesDialog();
		} catch (error) {
			handleDeleteError(
				target.type === "single"
					? Content["deleteHistoryEntriesDialog.error.single"]
					: Content["deleteHistoryEntriesDialog.error.multiple"],
			)(error);
		} finally {
			setIsDeleting(false);
		}
	};

	const getTitle = (): string => {
		if (target.type === "single") {
			return Content["deleteHistoryEntriesDialog.title.single"];
		}
		if (target.type === "selected") {
			return Content["deleteHistoryEntriesDialog.title.selected"].replace(
				"{count}",
				count,
			);
		}
		return Content["deleteHistoryEntriesDialog.title.all"];
	};

	const getConfirmation = (): ReactNode => {
		if (target.type === "single") {
			return (
				<>
					{Content["deleteHistoryEntriesDialog.confirmation.single.p1"]}{" "}
					<span className="underline">{formatChatName(target.chatName)}</span>{" "}
					{Content["deleteHistoryEntriesDialog.confirmation.single.p2"]}
				</>
			);
		}
		if (target.type === "selected") {
			return Content[
				"deleteHistoryEntriesDialog.confirmation.selected"
			].replace("{count}", count);
		}
		return Content["deleteHistoryEntriesDialog.confirmation.all"];
	};

	return (
		<DefaultDialog
			id={deleteHistoryEntriesDialogId}
			ariaLabelledBy={deleteHistoryEntriesDialogTitleId}
			className="w-full md:w-[29rem] gap-y-4 p-5"
			initialFocusRef={cancelButtonRef}
		>
			<form className="flex flex-col gap-y-1" onSubmit={handleSubmit}>
				<p
					id={deleteHistoryEntriesDialogTitleId}
					className="text-dunkelblau-100 font-bold text-lg leading-7"
				>
					{getTitle()}
				</p>
				<p className="text-dunkelblau-100 text-lg leading-7 font-normal">
					{getConfirmation()}
				</p>

				<div className="flex flex-row justify-end gap-3 mt-6">
					<TertiaryButton
						ref={cancelButtonRef}
						type="button"
						disabled={isDeleting}
						onClick={hideDeleteHistoryEntriesDialog}
					>
						{Content["deleteHistoryEntriesDialog.cancel"]}
					</TertiaryButton>
					<WarningButton type="submit" disabled={isDeleting}>
						{isDeleting ? (
							<span className="flex items-center gap-2">
								<LoadingSpinnerIcon variant="light" size="small" />
								{Content["deleteHistoryEntriesDialog.deleting"]}
							</span>
						) : (
							Content["deleteHistoryEntriesDialog.delete"]
						)}
					</WarningButton>
				</div>
			</form>
		</DefaultDialog>
	);
};
