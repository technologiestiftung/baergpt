import React from "react";
import { ChevronSmallIcon } from "../primitives/icons/chevron-small-icon.tsx";
import { useFolderStore } from "../../store/folder-store";
import { useDocumentStore } from "../../store/document-store.ts";
import { useDrop } from "react-dnd";
import type { ListItem } from "./document-list/list-item/utils/types";
import { useDragAndDropStore } from "../../store/drag-and-drop-store.ts";
import Content from "../../content.ts";

const DocumentBreadcrumbs: React.FC = () => {
	const { currentFolder, setCurrentFolder } = useFolderStore();
	const { hoveredFolderId, setHoveredFolderId } = useDragAndDropStore();
	const { removeItemFromFolder, getDocuments } = useDocumentStore();

	const [, drop] = useDrop({
		accept: "ITEM",
		drop: async (draggedItem: ListItem) => {
			// Dropping on the back-folder removes the folder association
			await removeItemFromFolder(draggedItem.id);
			await getDocuments(new AbortController().signal); // Refresh the documents list
			setHoveredFolderId(null);
		},
		hover: () => setHoveredFolderId("back-folder"),
	});

	const isHoveredForDrop = hoveredFolderId === "back-folder";

	return (
		<div className="w-full flex flex-col gap-1 mb-5 md:mb-0 md:gap-0 md:flex-row md:justify-between">
			<div className={`flex flex-row items-center gap-1 md:gap-2 text-lg`}>
				<button
					className={`focus-visible:outline-default rounded-3px hover:underline underline-offset-4 ${isHoveredForDrop && "bg-hellblau-100 outline-default outline-dunkelblau-100"}`}
					onClick={() => setCurrentFolder(null)}
					ref={drop}
				>
					{Content["documentsSection.mainFolder.label"]}
				</button>
				{currentFolder && (
					<>
						<ChevronSmallIcon direction="right" />
						<span className="break-all">{currentFolder.name}</span>
					</>
				)}
			</div>
		</div>
	);
};

export default DocumentBreadcrumbs;
