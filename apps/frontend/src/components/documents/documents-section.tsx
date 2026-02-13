import React from "react";
import { useDocumentStore } from "../../store/document-store.ts";
import { useFolderStore } from "../../store/folder-store.ts";
import { DesktopDocuments } from "./desktop-documents.tsx";
import { MobileDocuments } from "./mobile-documents.tsx";
import { DeleteItemDialog } from "./delete-item/delete-item-dialog.tsx";
import { CreateFolderDialog } from "./create-folder/create-folder-dialog.tsx";

export const DocumentsSection: React.FC = () => {
	const { documents, deletedDefaultDocumentIds } = useDocumentStore();
	const { folders } = useFolderStore();

	// Filter out deleted default documents by ID
	const filteredDocuments = documents.filter(
		(doc) => !deletedDefaultDocumentIds.includes(doc.id),
	);

	const hasItems = filteredDocuments.length > 0 || folders.length > 0;

	return (
		<>
			<DesktopDocuments hasItems={hasItems} />
			<MobileDocuments hasItems={hasItems} />
			<DeleteItemDialog />
			<CreateFolderDialog />
		</>
	);
};
