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

interface ListItemProps {
	item: ListItemType;
}

export const ListItem: React.FC<ListItemProps> = ({ item }) => {
	const { moveItemToFolder } = useUserDocumentStore();
	const { setHoveredFolderId, hoveredFolderId } = useDragAndDropStore();

	const isHoveredForDrop = getDragAndDropId(item) === hoveredFolderId;

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
		<li
			ref={dropRef}
			className={`hover:bg-hellblau-55 ${isHoveredForDrop ? "bg-hellblau-100 border border-dunkelblau-100 rounded-3px" : "border-b-[0.5px] border-y-hellblau-110"}`}
		>
			{isDocument(item) && <DocumentItem item={item} />}
			{isUserFolder(item) && <FolderItem item={item} />}
		</li>
	);
};
