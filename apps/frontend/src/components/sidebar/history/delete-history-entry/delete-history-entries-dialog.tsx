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
import { removeMarkdownStyling } from "../../chat-search/chat-search-utils";

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
	const sanitized = removeMarkdownStyling(chatName);
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

	const getVariantConfig = (): {
		title: string;
		confirmation: ReactNode;
		errorMessage: string;
		action: () => Promise<void>;
		shouldClearSelection: boolean;
	} => {
		switch (target.type) {
			case "single":
				return {
					title: Content["deleteHistoryEntriesDialog.title.single"],
					confirmation: (
						<>
							{Content["deleteHistoryEntriesDialog.confirmation.single.p1"]}{" "}
							<span className="underline">
								{formatChatName(target.chatName)}
							</span>{" "}
							{Content["deleteHistoryEntriesDialog.confirmation.single.p2"]}
						</>
					),
					errorMessage: Content["deleteHistoryEntriesDialog.error.single"],
					action: () => deleteChats([target.chatId]),
					shouldClearSelection: selectedChatIds.includes(target.chatId),
				};
			case "selected":
				return {
					title: Content["deleteHistoryEntriesDialog.title.selected"].replace(
						"{count}",
						count,
					),
					confirmation: Content[
						"deleteHistoryEntriesDialog.confirmation.selected"
					].replace("{count}", count),
					errorMessage: Content["deleteHistoryEntriesDialog.error.multiple"],
					action: () => deleteChats(selectedChatIds),
					shouldClearSelection: true,
				};
			case "all":
				return {
					title: Content["deleteHistoryEntriesDialog.title.all"],
					confirmation: Content["deleteHistoryEntriesDialog.confirmation.all"],
					errorMessage: Content["deleteHistoryEntriesDialog.error.multiple"],
					action: deleteAllChats,
					shouldClearSelection: true,
				};
			default: {
				const unhandledTarget: never = target;
				throw new Error(`Unhandled delete target: ${unhandledTarget}`);
			}
		}
	};

	const { title, confirmation, errorMessage, action, shouldClearSelection } =
		getVariantConfig();

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		if (target.type === "selected" && selectedChatIds.length === 0) {
			return;
		}

		setIsDeleting(true);

		try {
			await action();
			if (shouldClearSelection) {
				clearSelection();
			}
			hideDeleteHistoryEntriesDialog();
		} catch (error) {
			if (shouldClearSelection) {
				clearSelection();
			}
			hideDeleteHistoryEntriesDialog();
			captureError(error);
			useToastStore.getState().addError(errorMessage);
		} finally {
			setIsDeleting(false);
		}
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
					{title}
				</p>
				<p className="text-dunkelblau-100 text-lg leading-7 font-normal">
					{confirmation}
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
