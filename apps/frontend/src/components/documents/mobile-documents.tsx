import { BottomDrawer } from "../primitives/bottom-drawer/bottom-drawer.tsx";
import { useDrawerStore } from "../../store/drawer-store.ts";
import DocumentBreadcrumbs from "./document-breadcrumbs.tsx";
import { DocumentsList } from "./document-list/documents-list.tsx";
import Content from "../../content.ts";
import { MultiSelectForActionButton } from "./document-list/multi-select-for-action/multi-select-for-action-button.tsx";
import { DocumentDragPreview } from "./document-list/document-drag-preview.tsx";
import { CreateFolderButton } from "./create-folder/create-folder-button.tsx";
import { FileUpload } from "./file-upload/file-upload.tsx";
import { useCurrentFolderStore } from "../../store/use-current-folder-store.ts";
import { PublicFolders } from "./document-list/public-folders.tsx";
import { isUserFolder } from "./document-list/list-item/utils/is-user-folder.ts";
import { isPublicFolder } from "./document-list/list-item/utils/is-public-folder.ts";

export function MobileDocuments({ hasUserItems }: { hasUserItems: boolean }) {
	const { openDrawerId, setOpenDrawer } = useDrawerStore();
	const { currentFolder } = useCurrentFolderStore();

	const isDocumentsSectionOpen = openDrawerId === "documents";

	const handleToggle = () => {
		setOpenDrawer(isDocumentsSectionOpen ? null : "documents");
	};

	return (
		<BottomDrawer
			isOpen={isDocumentsSectionOpen}
			onClose={handleToggle}
			title={Content["documentsToggleButton.label"]}
			classNames="md:hidden"
		>
			{currentFolder && (
				<div className="mt-4 px-5">
					<DocumentBreadcrumbs />
				</div>
			)}

			{!currentFolder && (
				<div className="mt-4 px-5">
					<PublicFolders />

					<h2 className="mt-4 md:mt-8 leading-6 text-dunkelblau-100">
						{Content["documentsSection.mainFolder.label"]}
					</h2>
				</div>
			)}

			{(currentFolder === null || isUserFolder(currentFolder)) && (
				<div className="mt-4 flex md:hidden px-5 gap-x-2 mb-4">
					<CreateFolderButton />
					<MultiSelectForActionButton />
				</div>
			)}

			<div className="flex flex-col h-full px-5">
				<DocumentsList />

				{hasUserItems && <DocumentDragPreview />}

				{!isPublicFolder(currentFolder) && (
					<FileUpload hasItems={hasUserItems} />
				)}
			</div>
		</BottomDrawer>
	);
}
