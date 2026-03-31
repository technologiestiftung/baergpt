import { useState, useEffect } from "react";
import { useFolderStore } from "../../../../store/folder-store.ts";
import { useDocumentStore } from "../../../../store/document-store.ts";

export function useIsCollapsibleOpen() {
	const { selectedChatFolders } = useFolderStore();
	const { selectedChatDocuments } = useDocumentStore();

	const hasItems =
		selectedChatFolders.length > 0 || selectedChatDocuments.length > 0;

	const [isCollapsibleOpen, setIsCollapsibleOpen] = useState(false);

	useEffect(() => {
		if (!hasItems) {
			setIsCollapsibleOpen(false);
			return;
		}

		setIsCollapsibleOpen(true);
	}, [selectedChatFolders, selectedChatDocuments, hasItems]);

	return [isCollapsibleOpen, setIsCollapsibleOpen] as const;
}
