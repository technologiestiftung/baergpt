import React from "react";
import { DeleteItemDialog, showDeleteDialog } from "./delete-item-dialog";
import { useDocumentStore } from "../../../store/document-store";
import { useFolderStore } from "../../../store/folder-store";
import { SecondaryButton } from "../../primitives/buttons/secondary-button.tsx";
import { BucketIcon } from "../../primitives/icons/bucket-icon.tsx";
import Content from "../../../content.ts";

export const DeleteItemButton: React.FC<{ id: string }> = ({ id }) => {
	const { selectedDocumentsForAction } = useDocumentStore();
	const { selectedFoldersForAction } = useFolderStore();

	const itemsToDelete = [
		...selectedDocumentsForAction,
		...selectedFoldersForAction,
	];

	return (
		<>
			<SecondaryButton
				disabled={itemsToDelete.length === 0}
				onClick={() => showDeleteDialog(id)}
			>
				{Content["deleteItemButton.label"]}
				<BucketIcon disabled={itemsToDelete.length === 0} />
			</SecondaryButton>

			<DeleteItemDialog id={id} />
		</>
	);
};
