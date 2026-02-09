import type { Document, DocumentFolder } from "../../../../../common";
import { isDocument } from "./is-document";
import { useDocumentStore } from "../../../../../store/document-store";
import { useFolderStore } from "../../../../../store/folder-store";

export function setSingleSelectedItemForAction(
	item: Document | DocumentFolder,
) {
	const { setSingleSelectedDocumentForAction } = useDocumentStore.getState();
	const { setSingleSelectedFolderForAction } = useFolderStore.getState();

	if (isDocument(item)) {
		setSingleSelectedDocumentForAction(item as Document);
		setSingleSelectedFolderForAction(null);
	} else {
		setSingleSelectedFolderForAction(item as DocumentFolder);
		setSingleSelectedDocumentForAction(null);
	}
}
