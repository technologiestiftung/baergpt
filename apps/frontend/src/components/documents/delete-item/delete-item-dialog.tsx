import React, { type FormEvent } from "react";
import { DefaultDialog } from "../../primitives/dialogs/default-dialog";
import { useDocumentStore } from "../../../store/document-store";
import { useFolderStore } from "../../../store/folder-store";
import { TertiaryButton } from "../../primitives/buttons/tertiary-button.tsx";
import { PrimaryButton } from "../../primitives/buttons/primary-button.tsx";
import type { Document, DocumentFolder } from "../../../common.ts";
import { DocumentIcon } from "../../primitives/icons/document-icon.tsx";
import { FolderIcon } from "../../primitives/icons/folder-icon.tsx";
import { isDocument } from "../document-list/list-item/utils/is-document.ts";
import { getListItemName } from "../document-list/list-item/utils/get-list-item-name.ts";
import { getUniqueId } from "../document-list/list-item/utils/get-unique-id.ts";
import { useTooltipStore } from "../../../store/tooltip-store.ts";
import Content from "../../../content.ts";

const deleteDialogId = "delete-dialog";

export function showDeleteDialog() {
	(
		document.getElementById(`${deleteDialogId}`) as HTMLDialogElement
	).showModal();
}

export function hideDeleteDialog() {
	(document.getElementById(`${deleteDialogId}`) as HTMLDialogElement).close();
}

export const DeleteItemDialog: React.FC = () => {
	const { hideTooltip } = useTooltipStore();
	const { selectedDocumentsForAction, deleteDocument } = useDocumentStore();
	const { selectedFoldersForAction, deleteFolder } = useFolderStore();
	const itemsToDelete = [
		...selectedDocumentsForAction,
		...selectedFoldersForAction,
	];

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		hideDeleteDialog();

		for (const item of itemsToDelete) {
			if (isDocument(item)) {
				await deleteDocument(item.id);
			} else {
				await deleteFolder(item.id);
			}
		}
	};

	return (
		<DefaultDialog
			id={`${deleteDialogId}`}
			className="w-full md:w-[29rem] gap-y-4 p-5"
		>
			<form className="flex flex-col gap-y-1" onSubmit={handleSubmit}>
				<p className="text-dunkelblau-100 font-bold text-lg leading-7">
					{getDialogTitle(itemsToDelete)}
				</p>

				<p className="font-normal">{getDialogParagraph(itemsToDelete)}</p>

				<ul className="flex flex-col gap-y-1 mt-3">
					{getUserFriendlyItemNames(itemsToDelete)}
				</ul>

				<div className="flex flex-row justify-end gap-3 mt-6">
					<TertiaryButton
						type="button"
						onClick={() => {
							hideDeleteDialog();
							hideTooltip();
						}}
					>
						{Content["deleteItemDialog.cancel"]}
					</TertiaryButton>
					<PrimaryButton type="submit">
						{Content["deleteItemDialog.delete"]}
					</PrimaryButton>
				</div>
			</form>
		</DefaultDialog>
	);
};

function getDialogTitle(itemsToDelete: (Document | DocumentFolder)[]) {
	if (itemsToDelete.length > 1) {
		return `${itemsToDelete.length} ${Content["deleteItemDialog.deleteFiles"]}`;
	}

	const item = itemsToDelete[0];
	if (isDocument(item)) {
		return Content["deleteItemDialog.deleteFile"];
	}

	return Content["deleteItemDialog.deleteFolder"];
}

function getDialogParagraph(itemsToDelete: (Document | DocumentFolder)[]) {
	if (itemsToDelete.length > 1) {
		return `${Content["deleteItemDialog.confirmation.multipleItems"]}`;
	}

	return `${Content["deleteItemDialog.confirmation.singleItem"]}`;
}

function getUserFriendlyItemNames(
	itemsToDelete: (DocumentFolder | Document)[],
) {
	return itemsToDelete.map((item) => {
		return (
			<li
				key={getUniqueId(item)}
				className="flex gap-x-1 flex-row items-center text-base leading-6 font-normal"
			>
				{isDocument(item) ? (
					<DocumentIcon variant="lightBlue" className="size-4" />
				) : (
					<FolderIcon className="size-4" />
				)}
				<span className="w-0 grow truncate">{getListItemName(item)}</span>
			</li>
		);
	});
}
