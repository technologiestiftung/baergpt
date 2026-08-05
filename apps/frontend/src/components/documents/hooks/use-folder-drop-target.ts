import { useEffect } from "react";
import { useDrop } from "react-dnd";
import type { Document } from "../../../common.ts";
import { useDragAndDropStore } from "../../../store/drag-and-drop-store.ts";
import { isDocument } from "../document-list/list-item/utils/is-document.ts";

type UseFolderDropTargetOptions = {
	folderId: string;
	canDrop: (draggedItems: Document[]) => boolean;
	onDrop: (documents: Document[]) => void | Promise<void>;
};

export function useFolderDropTarget({
	folderId,
	canDrop,
	onDrop,
}: UseFolderDropTargetOptions) {
	const setHoveredFolderId = useDragAndDropStore(
		(state) => state.setHoveredFolderId,
	);

	const [{ isHoveredForDrop }, dropRef] = useDrop<
		Document[],
		unknown,
		{ isHoveredForDrop: boolean }
	>({
		accept: "ITEM",
		canDrop: (draggedItems) => {
			const documents = draggedItems.filter(isDocument);
			return documents.length > 0 && canDrop(draggedItems);
		},
		drop: async (draggedItems) => {
			const documents = draggedItems.filter(isDocument);
			if (documents.length === 0) {
				return;
			}

			setHoveredFolderId(null);
			await onDrop(documents);
		},
		collect: (monitor) => ({
			isHoveredForDrop: monitor.isOver({ shallow: true }) && monitor.canDrop(),
		}),
	});

	// necessary to reset the hovered folder id when the drop target is not hovered anymore
	useEffect(() => {
		if (isHoveredForDrop) {
			setHoveredFolderId(folderId);
			return;
		}

		if (useDragAndDropStore.getState().hoveredFolderId === folderId) {
			setHoveredFolderId(null);
		}
	}, [isHoveredForDrop, folderId, setHoveredFolderId]);

	return { dropRef, isHoveredForDrop };
}
