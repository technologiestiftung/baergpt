import React from "react";
import { useDocumentStore } from "../../store/document-store.ts";
import { useFolderStore } from "../../store/folder-store.ts";
import { DesktopDocuments } from "./desktop-documents.tsx";
import { MobileDocuments } from "./mobile-documents.tsx";

export const DocumentsSection: React.FC = () => {
	const { documents } = useDocumentStore();
	const { folders } = useFolderStore();

	const hasItems = [...documents, ...folders].length > 0;

	return (
		<>
			<DesktopDocuments hasItems={hasItems} />

			<MobileDocuments hasItems={hasItems} />
		</>
	);
};
