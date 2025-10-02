import React from "react";
import { useDrop } from "react-dnd";
import type { Document, DocumentFolder } from "../../../../common";
import FolderItem from "./folder-item";
import DocumentItem from "./document-item";
import { useDocumentStore } from "../../../../store/document-store";
import { isDocument } from "./utils/is-document.ts";
import type { ListItem as ListItemType } from "./utils/types.ts";
import { getDragAndDropId } from "./utils/get-drag-and-drop-id.ts";
import { useDragAndDropStore } from "../../../../store/drag-and-drop-store.ts";

interface ListItemProps {
	item: Document | DocumentFolder;
}

export const ListItem: React.FC<ListItemProps> = ({ item }) => {
	const { moveItemToFolder } = useDocumentStore();
	const { setHoveredFolderId } = useDragAndDropStore();

	const [, dropRef] = useDrop({
		accept: "ITEM",
		drop: async (draggedItem: ListItemType) => {
			const isValidTarget = !isDocument(item) && isDocument(draggedItem);

			if (isValidTarget) {
				await moveItemToFolder(draggedItem.id, item.id);
			}

			// Reset hovered folder when the drop is complete
			setHoveredFolderId(null);
		},
		hover: (draggedItem: ListItemType) => {
			const isValidTarget = !isDocument(item) && isDocument(draggedItem);

			if (isValidTarget) {
				setHoveredFolderId(getDragAndDropId(item));
				return;
			}

			setHoveredFolderId(null);
		},
	});

	return (
		<li ref={dropRef} className="flex gap-x-2 items-center">
			{isDocument(item) ? (
				<DocumentItem item={item} />
			) : (
				<FolderItem item={item} />
			)}
		</li>
	);
};
