import React from "react";
import type { Document } from "../../../../common";
import { useDocumentStore } from "../../../../store/document-store";
import { useDocumentsListStore } from "../../../../store/use-documents-list-store.ts";
import Checkbox from "../../../primitives/checkboxes/checkbox";
import { DraggableDocumentName } from "./draggable-document-name.tsx";
import Content from "../../../../content.ts";
import { ToggleChatItemButton } from "./toggle-chat-item-button.tsx";
import { ItemDropdownButton } from "./dropdown/item-dropdown-button.tsx";

interface DocumentItemProps {
	item: Document;
}

const DocumentItem: React.FC<DocumentItemProps> = ({ item }) => {
	const {
		selectDocumentForAction,
		unselectDocumentForAction,
		selectedDocumentsForAction,
		selectedChatDocuments,
		toggleChatDocument,
		selectedPreviewDocument,
	} = useDocumentStore();
	const { isMultiSelectForActionVisible } = useDocumentsListStore();

	const isSelectedForAction = selectedDocumentsForAction.some(
		(doc) => doc.id === item.id,
	);
	const isSelectedForChat = selectedChatDocuments.some(
		(doc) => doc.id === item.id,
	);

	const isSelectedForPreview = selectedPreviewDocument?.id === item.id;

	const handleCheckboxChange = (checked: boolean) => {
		if (checked) {
			selectDocumentForAction(item);
			return;
		}
		unselectDocumentForAction(item.id);
	};

	return (
		<div
			className={`flex gap-x-2 items-center pl-5 md:pl-2.5 ${isSelectedForPreview && "bg-hellblau-55"} ${isSelectedForChat && "bg-hellblau-60"}`}
		>
			<div className={isMultiSelectForActionVisible ? "flex" : "hidden"}>
				<Checkbox
					id={`${item.id.toString()}-document`}
					checked={isSelectedForAction}
					onChange={handleCheckboxChange}
					ariaLabel={Content["documentsList.document.checkbox.ariaLabel"]}
				/>
			</div>

			<div
				className={`h-11 gap-x-1 flex justify-between items-center w-0 grow hover:bg-hellblau-55 group`}
			>
				<DraggableDocumentName item={item} />

				<ToggleChatItemButton
					handleToggleChatItem={() => toggleChatDocument(item)}
					isSelectedForChat={isSelectedForChat}
				/>
				<ItemDropdownButton item={item} />
			</div>
		</div>
	);
};

export default DocumentItem;
