import { useFolderStore } from "../../../store/folder-store.ts";
import { useDocumentStore } from "../../../store/document-store.ts";
import Content from "../../../content.ts";
import { isDocument } from "../../documents/document-list/list-item/utils/is-document.ts";
import type { ListItem } from "../../documents/document-list/list-item/utils/types.ts";

export function SelectedChatItemsLabel() {
	const { selectedChatFolders } = useFolderStore();
	const { selectedChatDocuments } = useDocumentStore();

	const selectedChatItems = [...selectedChatFolders, ...selectedChatDocuments];
	const selectedChatItemsAmount = selectedChatItems.length;

	return (
		<span className="text-sm leading-5 text-dunkelblau-100">
			<span className="font-semibold px-0.5">{selectedChatItemsAmount}</span>{" "}
			{getSelectedItemsLabel(selectedChatItems)}
		</span>
	);
}

function getSelectedItemsLabel(selectedItems: ListItem[]) {
	if (selectedItems.length > 1) {
		return Content["chat.selectedChatItems.items"];
	}

	const item = selectedItems[0];
	if (isDocument(item)) {
		return Content["chat.selectedChatItems.document"];
	}

	return Content["chat.selectedChatItems.folder"];
}
