import React from "react";
import { useUserDocumentStore } from "../../store/use-user-document-store.ts";
import { useUserFolderStore } from "../../store/use-user-folder-store.ts";
import { DesktopDocuments } from "./desktop-documents.tsx";
import { MobileDocuments } from "./mobile-documents.tsx";
import { DeleteItemDialog } from "./delete-item/delete-item-dialog.tsx";
import { CreateFolderDialog } from "./create-folder/create-folder-dialog.tsx";
import { RenameFolderDialog } from "./rename-folder/rename-folder-dialog.tsx";

export const DocumentsSection: React.FC = () => {
	const { userDocuments, deletedDefaultDocumentIds } = useUserDocumentStore();
	const { userFolders } = useUserFolderStore();

	// Filter out deleted default documents by ID
	const filteredDocuments = userDocuments.filter(
		(doc) => !deletedDefaultDocumentIds.includes(doc.id),
	);

	const hasUserItems = filteredDocuments.length > 0 || userFolders.length > 0;

	return (
		<>
			<DesktopDocuments hasUserItems={hasUserItems} />
			<MobileDocuments hasUserItems={hasUserItems} />
			<DeleteItemDialog />
			<CreateFolderDialog />
			<RenameFolderDialog />
		</>
	);
};
