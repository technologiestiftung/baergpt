import React from "react";
import type { Document } from "../../../../common";
import { useDocumentStore } from "../../../../store/document-store";
import { useDocumentsListStore } from "../../../../store/use-documents-list-store.ts";
import Checkbox from "../../../primitives/checkboxes/checkbox";
import { DraggableDocumentName } from "./draggable-document-name.tsx";
import Content from "../../../../content.ts";
import { ToggleChatItemButton } from "./toggle-chat-item-button.tsx";

interface DocumentItemProps {
	item: Document;
}

const DocumentItem: React.FC<DocumentItemProps> = ({ item }) => {
	const {
		selectDocumentForAction,
		unselectDocumentForAction,
		selectedDocumentsForAction,
		selectChatDocument,
		unselectChatDocument,
		selectedChatDocuments,
	} = useDocumentStore();
	const { isMultiSelectForActionVisible } = useDocumentsListStore();

	const isSelectedForAction = selectedDocumentsForAction.some(
		(doc) => doc.id === item.id,
	);
	const isSelectedForChat = selectedChatDocuments.some(
		(doc) => doc.id === item.id,
	);

	const handleCheckboxChange = (checked: boolean) => {
		if (checked) {
			selectDocumentForAction(item);
			return;
		}
		unselectDocumentForAction(item.id);
	};

	const handleToggleChatItem = (itemToAddToChat: Document) => {
		if (selectedChatDocuments.some((doc) => doc.id === itemToAddToChat.id)) {
			unselectChatDocument(itemToAddToChat.id);
			return;
		}
		selectChatDocument(itemToAddToChat);
	};

	return (
		<>
			<div className={isMultiSelectForActionVisible ? "flex" : "hidden"}>
				<Checkbox
					id={`${item.id.toString()}-document`}
					checked={isSelectedForAction}
					onChange={handleCheckboxChange}
					ariaLabel={Content["documentsList.document.checkbox.ariaLabel"]}
				/>
			</div>

			<div
				className={`h-11 gap-x-2 flex justify-between items-center w-0 grow hover:bg-hellblau-55 group ${isSelectedForChat && "bg-hellblau-60"}`}
			>
				<DraggableDocumentName item={item} />

				<ToggleChatItemButton
					handleToggleChatItem={() => handleToggleChatItem(item)}
					isSelectedForChat={isSelectedForChat}
				/>
			</div>
		</>
	);
};

export default DocumentItem;
