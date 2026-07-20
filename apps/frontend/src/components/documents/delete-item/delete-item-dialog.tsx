import React, { type FormEvent } from "react";
import { DefaultDialog } from "../../primitives/dialogs/default-dialog";
import { useUserDocumentStore } from "../../../store/use-user-document-store.ts";
import { useUserFolderStore } from "../../../store/use-user-folder-store.ts";
import { useDocumentsListStore } from "../../../store/use-documents-list-store";
import { TertiaryButton } from "../../primitives/buttons/tertiary-button.tsx";
import type { UserDocument, UserFolder } from "../../../common.ts";
import { isDocument } from "../document-list/list-item/utils/is-document.ts";
import { getListItemName } from "../document-list/list-item/utils/get-list-item-name.ts";
import { useTooltipStore } from "../../../store/tooltip-store.ts";
import Content from "../../../content.ts";
import { WarningButton } from "../../primitives/buttons/warning-button.tsx";
import { FolderIcon } from "../../primitives/icons/folder-icon.tsx";
import { DocumentIcon } from "../../primitives/icons/document-icon.tsx";
import { getUniqueId } from "../document-list/list-item/utils/get-unique-id.ts";
import { usePreviewDocumentStore } from "../../../store/use-preview-document-store.ts";

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
	const {
		selectedUserDocumentsForAction,
		deleteUserDocument,
		unselectUserDocumentForAction,
	} = useUserDocumentStore();
	const { unselectPreviewDocument } = usePreviewDocumentStore();
	const {
		selectedUserFoldersForAction,
		deleteUserFolder,
		unselectFolderForAction,
	} = useUserFolderStore();
	const { singleItemSelectedForAction, setSingleItemSelectedForAction } =
		useDocumentsListStore();

	const itemsToDelete: (UserDocument | UserFolder)[] =
		singleItemSelectedForAction !== null
			? [singleItemSelectedForAction]
			: [...selectedUserDocumentsForAction, ...selectedUserFoldersForAction];

	const isMultipleItemsToDelete = itemsToDelete.length > 1;

	const clearSelectionAfterDelete = () => {
		if (singleItemSelectedForAction !== null) {
			setSingleItemSelectedForAction(null);
		} else {
			for (const item of itemsToDelete) {
				if (isDocument(item)) {
					unselectUserDocumentForAction(item.id);
				} else {
					unselectFolderForAction(item.id);
				}
			}
		}
	};

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		unselectPreviewDocument();
		hideDeleteDialog();

		for (const item of itemsToDelete) {
			if (isDocument(item)) {
				await deleteUserDocument(item.id);
			} else {
				await deleteUserFolder(item.id);
			}
		}
		clearSelectionAfterDelete();
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

				<div className="text-dunkelblau-100 text-lg leading-7 font-normal mt-1">
					{getDialogParagraph(itemsToDelete)}
				</div>

				{isMultipleItemsToDelete && (
					<ul className="flex flex-col gap-y-1 mt-3">
						{getUserFriendlyItemNames(itemsToDelete)}
					</ul>
				)}

				<div className="flex flex-row justify-end gap-3 mt-6">
					<TertiaryButton
						type="button"
						onClick={() => {
							setSingleItemSelectedForAction(null);
							hideDeleteDialog();
							hideTooltip();
						}}
					>
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

function getDialogTitle(itemsToDelete: (UserDocument | UserFolder)[]) {
	if (itemsToDelete.length > 1) {
		return `${itemsToDelete.length} ${Content["deleteItemDialog.deleteFiles"]}`;
	}

	const item = itemsToDelete[0];
	if (isDocument(item)) {
		return Content["deleteItemDialog.deleteFile"];
	}

	return Content["deleteItemDialog.deleteFolder"];
}

function getDialogParagraph(itemsToDelete: (UserDocument | UserFolder)[]) {
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

function getUserFriendlyItemNames(
	itemsToDelete: (UserDocument | UserFolder)[],
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
