import type { Document, DocumentFolder } from "../../../../../common";
import { isDocument } from "./is-document";
import { useDocumentStore } from "../../../../../store/document-store";
import { useFolderStore } from "../../../../../store/folder-store";

export function isItemSelectedForChat(
	item: Document | DocumentFolder,
): boolean {
	const selectedChatDocuments = useDocumentStore.getState().selectedChatDocuments;
	const selectedChatFolders = useFolderStore.getState().selectedChatFolders;

	return isDocument(item)
		? selectedChatDocuments.some((doc) => doc.id === item.id)
		: selectedChatFolders.some((fol) => fol.id === item.id);
}
