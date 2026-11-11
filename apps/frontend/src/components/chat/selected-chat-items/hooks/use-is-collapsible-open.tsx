import { useState, useEffect } from "react";
import { useUserFolderStore } from "../../../../store/use-user-folder-store.ts";
import { useUserDocumentStore } from "../../../../store/use-user-document-store.ts";
import { usePublicDocumentsStore } from "../../../../store/use-public-documents-store.ts";
import {
	type FileUpload,
	isFailedUpload,
} from "../../../../store/use-file-uploads-store.ts";

export function useIsCollapsibleOpen(chatFileUploads: FileUpload[]) {
	const { selectedUserChatFolders: selectedUserChatFolders } =
		useUserFolderStore();
	const { selectedUserChatDocuments } = useUserDocumentStore();
	const { selectedPublicChatFolders, selectedPublicChatDocuments } =
		usePublicDocumentsStore();

	const chatFileUploadsCount = chatFileUploads.length;
	const failedChatFileUploadsCount = chatFileUploads.filter(({ status }) =>
		isFailedUpload(status),
	).length;

	const hasItems =
		selectedUserChatDocuments.length > 0 ||
		selectedPublicChatDocuments.length > 0 ||
		selectedUserChatFolders.length > 0 ||
		selectedPublicChatFolders.length > 0 ||
		chatFileUploadsCount > 0;

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
		chatFileUploadsCount,
	]);

	// A pending pill turning into a failed one keeps the pill count the same,
	// so the effect above would leave a collapsed section closed.
	useEffect(() => {
		if (failedChatFileUploadsCount > 0) {
			setIsCollapsibleOpen(true);
		}
	}, [failedChatFileUploadsCount]);

	return [isCollapsibleOpen, setIsCollapsibleOpen] as const;
}
