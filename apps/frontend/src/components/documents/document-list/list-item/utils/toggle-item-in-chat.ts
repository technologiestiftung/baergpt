import type { Document, PublicFolder, UserFolder } from "../../../../../common";
import { useUserDocumentStore } from "../../../../../store/use-user-document-store.ts";
import { useUserFolderStore } from "../../../../../store/use-user-folder-store.ts";
import { usePublicDocumentsStore } from "../../../../../store/use-public-documents-store.ts";
import { isUserFolder } from "./is-user-folder.ts";
import { isPublicFolder } from "./is-public-folder.ts";
import { isUserDocument } from "./is-user-document.ts";
import { isPublicDocument } from "./is-public-document.ts";

export function toggleItemInChat(
	item: Document | UserFolder | PublicFolder,
): void {
	if (isUserDocument(item)) {
		useUserDocumentStore.getState().toggleUserChatDocument(item);
		return;
	}

	if (isPublicDocument(item)) {
		usePublicDocumentsStore.getState().togglePublicChatDocument(item);
		return;
	}

	if (isUserFolder(item)) {
		useUserFolderStore.getState().toggleChatFolder(item);
		return;
	}

	if (isPublicFolder(item)) {
		usePublicDocumentsStore.getState().togglePublicChatFolder(item);
		return;
	}
}
