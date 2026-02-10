import type { Document, DocumentFolder } from "../../../../../common";
import { isDocument } from "./is-document";
import { useDocumentStore } from "../../../../../store/document-store";
import { useFolderStore } from "../../../../../store/folder-store";

export function toggleItemInChat(item: Document | DocumentFolder): void {
	if (isDocument(item)) {
		useDocumentStore.getState().toggleChatDocument(item);
	} else {
		useFolderStore.getState().toggleChatFolder(item);
	}
}
