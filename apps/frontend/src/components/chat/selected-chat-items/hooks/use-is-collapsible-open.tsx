import { useState, useEffect } from "react";
import { useUserFolderStore } from "../../../../store/use-user-folder-store.ts";
import { useUserDocumentStore } from "../../../../store/use-user-document-store.ts";
import { usePublicDocumentsStore } from "../../../../store/use-public-documents-store.ts";

export function useIsCollapsibleOpen() {
	const { selectedUserChatFolders } = useUserFolderStore();
	const { selectedUserChatDocuments } = useUserDocumentStore();
	const { selectedPublicChatFolders, selectedPublicChatDocuments } =
		usePublicDocumentsStore();

	const hasItems =
		selectedUserChatDocuments.length > 0 ||
		selectedPublicChatDocuments.length > 0 ||
		selectedUserChatFolders.length > 0 ||
		selectedPublicChatFolders.length > 0;

	const [isCollapsibleOpen, setIsCollapsibleOpen] = useState(false);

	useEffect(() => {
		if (!hasItems) {
			setIsCollapsibleOpen(false);
			return;
		}

		setIsCollapsibleOpen(true);
	}, [
		selectedUserChatDocuments,
		selectedPublicChatDocuments,
		selectedUserChatFolders,
		selectedPublicChatFolders,
	]);

	return [isCollapsibleOpen, setIsCollapsibleOpen] as const;
}
