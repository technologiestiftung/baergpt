import { ChevronSmallIcon } from "../primitives/icons/chevron-small-icon.tsx";
import { useUserDocumentStore } from "../../store/use-user-document-store.ts";
import { useDrop } from "react-dnd";
import type { ListItem } from "./document-list/list-item/utils/types";
import { useDragAndDropStore } from "../../store/drag-and-drop-store.ts";
import Content from "../../content.ts";
import { useCurrentFolderStore } from "../../store/use-current-folder-store.ts";
import { isPublicFolder } from "./document-list/list-item/utils/is-public-folder.ts";
import { isUserFolder } from "./document-list/list-item/utils/is-user-folder.ts";

export function DocumentBreadcrumbs() {
	const { currentFolder, setCurrentFolder } = useCurrentFolderStore();
	const { hoveredFolderId, setHoveredFolderId } = useDragAndDropStore();
	const { removeItemFromFolder, getUserDocuments } = useUserDocumentStore();

	const [, drop] = useDrop({
		accept: "ITEM",
		drop: async (draggedItem: ListItem) => {
			// Dropping on the back-folder removes the folder association
			await removeItemFromFolder(draggedItem.id);
			await getUserDocuments(new AbortController().signal); // Refresh the documents list
			setHoveredFolderId(null);
		},
		hover: () => setHoveredFolderId("back-folder"),
		canDrop: () => isUserFolder(currentFolder),
	});

	const resetCurrentFolder = () => {
		if (currentFolder) {
			setCurrentFolder(null);
		}
	};

	const isHoveredForDrop =
		isUserFolder(currentFolder) && hoveredFolderId === "back-folder";

	return (
		<div className="w-full flex flex-col h-8 mb-4 md:mb-0 md:flex-row md:justify-between">
			<div
				className={`flex flex-row items-center gap-1 text-base leading-6 font-normal text-dunkelblau-100`}
			>
				<button
					className={`focus-visible:outline-default rounded-3px hover:underline underline-offset-4 px-0.5 ${isHoveredForDrop && "bg-hellblau-100 outline outline-1 outline-dunkelblau-100"}`}
					onClick={resetCurrentFolder}
					ref={drop}
				>
					{currentFolder && isPublicFolder(currentFolder)
						? Content["documentSection.publicFolders.label"]
						: Content["documentsSection.mainFolder.label"]}
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
}

export default DocumentBreadcrumbs;
