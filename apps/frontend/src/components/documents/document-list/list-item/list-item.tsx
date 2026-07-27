import React from "react";
import FolderItem from "./folder-item";
import DocumentItem from "./document-item";
import { useUserDocumentStore } from "../../../../store/use-user-document-store.ts";
import { isDocument } from "./utils/is-document.ts";
import type { ListItem as ListItemType } from "./utils/types.ts";
import { getDragAndDropId } from "./utils/get-drag-and-drop-id.ts";
import { isUserFolder } from "./utils/is-user-folder.ts";
import { useFolderDropTarget } from "../../hooks/use-folder-drop-target.ts";

interface ListItemProps {
	item: ListItemType;
}

export const ListItem: React.FC<ListItemProps> = ({ item }) => {
	const { moveItemsToFolder, unselectUserDocumentForAction } =
		useUserDocumentStore();

	const { dropRef, isHoveredForDrop } = useFolderDropTarget({
		folderId: getDragAndDropId(item),
		canDrop: () => !isDocument(item),
		onDrop: async (documents) => {
			const documentIds = documents.map((doc) => doc.id);
			await moveItemsToFolder(documentIds, item.id);

			for (const id of documentIds) {
				unselectUserDocumentForAction(id);
			}
		},
	});

	return (
		<li
			ref={dropRef}
			className={`hover:bg-hellblau-55 ${isHoveredForDrop ? "bg-hellblau-100 border border-dunkelblau-100 rounded-3px" : "border-b-[0.5px] border-y-hellblau-110"}`}
		>
			{isDocument(item) && <DocumentItem item={item} />}
			{isUserFolder(item) && <FolderItem item={item} />}
		</li>
	);
};
