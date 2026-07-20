import React from "react";
import { useDrop } from "react-dnd";
import FolderItem from "./folder-item";
import DocumentItem from "./document-item";
import { useUserDocumentStore } from "../../../../store/use-user-document-store.ts";
import { isDocument } from "./utils/is-document.ts";
import type { ListItem as ListItemType } from "./utils/types.ts";
import { getDragAndDropId } from "./utils/get-drag-and-drop-id.ts";
import { useDragAndDropStore } from "../../../../store/drag-and-drop-store.ts";
import { isUserFolder } from "./utils/is-user-folder.ts";
import type { Document } from "../../../../common.ts";

interface ListItemProps {
	item: ListItemType;
}

export const ListItem: React.FC<ListItemProps> = ({ item }) => {
	const { moveItemsToFolder, unselectUserDocumentForAction } =
		useUserDocumentStore();
	const { setHoveredFolderId, hoveredFolderId } = useDragAndDropStore();

	const isHoveredForDrop = getDragAndDropId(item) === hoveredFolderId;

	const [, dropRef] = useDrop<Document[], unknown, unknown>({
		accept: "ITEM",
		drop: async (draggedItems: Document[]) => {
			const documents = draggedItems.filter(isDocument);
			const isValidTarget = !isDocument(item) && documents.length > 0;

			if (isValidTarget) {
				const documentIds = documents.map((doc) => doc.id);

				setHoveredFolderId(null);
				await moveItemsToFolder(documentIds, item.id);

				for (const id of documentIds) {
					unselectUserDocumentForAction(id);
				}
			}
		},
		hover: (draggedItems: Document[]) => {
			const documents = draggedItems.filter(isDocument);
			const isValidTarget = !isDocument(item) && documents.length > 0;

			if (isValidTarget) {
				setHoveredFolderId(getDragAndDropId(item));
				return;
			}

			setHoveredFolderId(null);
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
