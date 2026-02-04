import React, { type FormEvent } from "react";
import { DefaultDialog } from "../../primitives/dialogs/default-dialog";
import { useDocumentStore } from "../../../store/document-store";
import { useFolderStore } from "../../../store/folder-store";
import { TertiaryButton } from "../../primitives/buttons/tertiary-button.tsx";
import type { Document, DocumentFolder } from "../../../common.ts";
import { isDocument } from "../document-list/list-item/utils/is-document.ts";
import { getListItemName } from "../document-list/list-item/utils/get-list-item-name.ts";
import Content from "../../../content.ts";
import { WarningButton } from "../../primitives/buttons/warning-button.tsx";

const deleteDialogId = "delete-dialog";

export function showDeleteDialog(id: string) {
	(
		document.getElementById(`${deleteDialogId}-${id}`) as HTMLDialogElement
	).showModal();
}

export function hideDeleteDialog(id: string) {
	(
		document.getElementById(`${deleteDialogId}-${id}`) as HTMLDialogElement
	).close();
}

interface DeleteItemDialogProps {
	id: string;
	dropdownItemToDelete?: Document | DocumentFolder;
}

export const DeleteItemDialog: React.FC<DeleteItemDialogProps> = ({
	id,
	dropdownItemToDelete,
}) => {
	const { selectedDocumentsForAction, deleteDocument } = useDocumentStore();
	const { selectedFoldersForAction, deleteFolder } = useFolderStore();

	const itemsToDelete = dropdownItemToDelete
		? [dropdownItemToDelete]
		: [...selectedDocumentsForAction, ...selectedFoldersForAction];

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		hideDeleteDialog(id);

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
			id={`${deleteDialogId}-${id}`}
			className="w-full md:w-[29rem] gap-y-4 p-5"
		>
			<form className="flex flex-col gap-y-1" onSubmit={handleSubmit}>
				<p className="text-dunkelblau-100 font-bold text-lg">
					{getDialogTitle(itemsToDelete)}
				</p>

				<p className="text-dunkelblau-100 text-lg leading-7 font-normal mt-1">
					{getDialogParagraph(itemsToDelete)}
				</p>

				<div className="flex flex-row justify-end gap-4 mt-6">
					<TertiaryButton type="button" onClick={() => hideDeleteDialog(id)}>
						{Content["deleteItemDialog.cancel"]}
					</TertiaryButton>
					<WarningButton type="submit">
						{Content["deleteItemDialog.delete"]}
					</WarningButton>
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

	return (
		<p>
			{Content["deleteItemDialog.confirmation.singleItem.p1"]}{" "}
			<span className="underline">{getListItemName(itemsToDelete[0])}</span>{" "}
			{Content["deleteItemDialog.confirmation.singleItem.p2"]}
		</p>
	);
}
