import { ChevronSmallIcon } from "../primitives/icons/chevron-small-icon.tsx";
import { useUserDocumentStore } from "../../store/use-user-document-store.ts";
import Content from "../../content.ts";
import { useCurrentFolderStore } from "../../store/use-current-folder-store.ts";
import { isPublicFolder } from "./document-list/list-item/utils/is-public-folder.ts";
import { isUserFolder } from "./document-list/list-item/utils/is-user-folder.ts";
import { getDragAndDropId } from "./document-list/list-item/utils/get-drag-and-drop-id.ts";
import { useFolderDropTarget } from "./hooks/use-folder-drop-target.ts";

export function DocumentBreadcrumbs() {
	const { currentFolder, setCurrentFolder } = useCurrentFolderStore();
	const { removeItemsFromFolder, unselectUserDocumentForAction } =
		useUserDocumentStore();

	const { dropRef, isHoveredForDrop } = useFolderDropTarget({
		folderId: getDragAndDropId(null),
		canDrop: () => isUserFolder(currentFolder),
		onDrop: async (documents) => {
			const documentIds = documents.map((doc) => doc.id);
			await removeItemsFromFolder(documentIds);

			for (const id of documentIds) {
				unselectUserDocumentForAction(id);
			}
		},
	});

	const resetCurrentFolder = () => {
		if (currentFolder) {
			setCurrentFolder(null);
		}
	};

	return (
		<div className="w-full flex flex-col h-8 mb-4 md:mb-0 md:flex-row md:justify-between">
			<div
				className={`flex flex-row items-center gap-1 text-base leading-6 font-normal text-dunkelblau-100`}
			>
				<button
					className={`focus-visible:outline-default rounded-3px hover:underline underline-offset-4 px-0.5 ${isHoveredForDrop && "bg-hellblau-100 outline outline-1 outline-dunkelblau-100"}`}
					onClick={resetCurrentFolder}
					ref={dropRef}
				>
					{currentFolder && isPublicFolder(currentFolder)
						? Content["documentSection.publicFolder.label"]
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
