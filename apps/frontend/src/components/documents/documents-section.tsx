import React from "react";
import { useDocumentStore } from "../../store/document-store.ts";
import { useFolderStore } from "../../store/folder-store.ts";
import { DesktopDocuments } from "./desktop-documents.tsx";
import { MobileDocuments } from "./mobile-documents.tsx";

export const DocumentsSection: React.FC = () => {
	const { documents, isDefaultDocumentDeleted } = useDocumentStore();
	const { folders } = useFolderStore();

	// Filter out default documents if isDefaultDocumentDeleted
	const filteredDocuments = isDefaultDocumentDeleted
		? documents.filter((doc) => doc.source_type !== "default_document")
		: documents;

	const hasItems = filteredDocuments.length > 0 || folders.length > 0;

	return (
		<>
			<DesktopDocuments hasItems={hasItems} />

			<MobileDocuments hasItems={hasItems} />
		</>
	);
};
