import React from "react";
import type { Document } from "../../../../common";
import { useDocumentStore } from "../../../../store/document-store";
import Checkbox from "../../../primitives/checkboxes/checkbox";
import { AddToChatButton } from "./add-to-chat-button";
import { DraggableDocumentName } from "./draggable-document-name.tsx";
import { useMobileMenuStore } from "../../../../store/use-mobile-menu.ts";
import Content from "../../../../content.ts";
import { RemoveFromChatButton } from "./remove-from-chat-button.tsx";

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
	const { isMobileCheckboxVisible } = useMobileMenuStore();

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

	const handleToggleDocumentInChat = (itemToAddToChat: Document) => {
		if (selectedChatDocuments.some((doc) => doc.id === itemToAddToChat.id)) {
			unselectChatDocument(itemToAddToChat.id);
			return;
		}
		selectChatDocument(itemToAddToChat);
	};

	return (
		<>
			<div className={`${isMobileCheckboxVisible ? "flex" : "hidden"} md:flex`}>
				<Checkbox
					id={`${item.id.toString()}-document`}
					checked={isSelectedForAction}
					onChange={handleCheckboxChange}
					ariaLabel={Content["documentsList.document.checkbox.ariaLabel"]}
				/>
			</div>

			<div
				className={`h-11 pl-2.5 gap-x-2 flex justify-between items-center w-0 grow hover:bg-hellblau-55 ${isSelectedForChat && "bg-hellblau-60"}`}
			>
				<DraggableDocumentName item={item} />

				{isSelectedForChat ? (
					<RemoveFromChatButton
						handleRemoveFromChat={() => handleToggleDocumentInChat(item)}
					/>
				) : (
					<AddToChatButton
						handleAddToChat={() => handleToggleDocumentInChat(item)}
					/>
				)}
			</div>
		</>
	);
};

export default DocumentItem;
