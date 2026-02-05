import { BottomDrawer } from "../primitives/bottom-drawer/bottom-drawer.tsx";
import { useDrawerStore } from "../../store/drawer-store.ts";
import DocumentBreadcrumbs from "./document-breadcrumbs.tsx";
import { DocumentsList } from "./document-list/documents-list.tsx";
import Content from "../../content.ts";
import { MultiSelectForActionButton } from "./document-list/multi-select-for-action/multi-select-for-action-button.tsx";
import { DocumentDragPreview } from "./document-list/document-drag-preview.tsx";
import { CreateFolderButton } from "./create-folder/create-folder-button.tsx";

export function MobileDocuments({ hasItems }: { hasItems: boolean }) {
	const { openDrawerId, setOpenDrawer } = useDrawerStore();
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
			<div className="mt-4 px-5">
				<DocumentBreadcrumbs />
			</div>

			<div className="flex md:hidden px-5 gap-x-2 mb-4">
				<CreateFolderButton />
				<MultiSelectForActionButton />
			</div>

			{hasItems && (
				<div className="flex h-full px-5">
					<DocumentsList />
					<DocumentDragPreview />
				</div>
			)}
		</BottomDrawer>
	);
}
