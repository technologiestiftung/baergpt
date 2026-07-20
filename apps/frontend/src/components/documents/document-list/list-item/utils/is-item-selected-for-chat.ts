import type { Document, UserFolder, PublicFolder } from "../../../../../common";
import { isDocument } from "./is-document";
import { useUserDocumentStore } from "../../../../../store/use-user-document-store.ts";
import { useUserFolderStore } from "../../../../../store/use-user-folder-store.ts";
import { usePublicDocumentsStore } from "../../../../../store/use-public-documents-store.ts";

export function isItemSelectedForChat(
	item: Document | UserFolder | PublicFolder,
): boolean {
	const selectedChatDocuments =
		useUserDocumentStore.getState().selectedUserChatDocuments;
	const selectedChatFolders =
		useUserFolderStore.getState().selectedUserChatFolders;
	const { selectedPublicChatDocuments, selectedPublicChatFolders } =
		usePublicDocumentsStore.getState();

	return isDocument(item)
		? selectedChatDocuments.some(({ id }) => id === item.id) ||
				selectedPublicChatDocuments.some(({ id }) => id === item.id)
		: selectedChatFolders.some(({ id }) => id === item.id) ||
				selectedPublicChatFolders.some(({ id }) => id === item.id);
}
