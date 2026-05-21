import React from "react";
import type { Document } from "../../../../common";
import { useUserDocumentStore } from "../../../../store/use-user-document-store.ts";
import { useDocumentsListStore } from "../../../../store/use-documents-list-store.ts";
import Checkbox from "../../../primitives/checkboxes/checkbox";
import { DraggableDocumentName } from "./draggable-document-name.tsx";
import Content from "../../../../content.ts";
import { ToggleChatItemButton } from "./toggle-chat-item-button.tsx";
import { ItemDropdownButton } from "./dropdown/item-dropdown-button.tsx";
import { usePreviewDocumentStore } from "../../../../store/use-preview-document-store.ts";
import { usePublicDocumentsStore } from "../../../../store/use-public-documents-store.ts";
import { isUserDocument } from "./utils/is-user-document.ts";
import { isPublicDocument } from "./utils/is-public-document.ts";

interface DocumentItemProps {
	item: Document;
}

const DocumentItem: React.FC<DocumentItemProps> = ({ item }) => {
	const {
		selectUserDocumentForAction,
		unselectUserDocumentForAction,
		selectedUserDocumentsForAction,
		selectedUserChatDocuments,
		toggleUserChatDocument,
	} = useUserDocumentStore();
	const { selectedPreviewDocument } = usePreviewDocumentStore();
	const { isMultiSelectForActionVisible } = useDocumentsListStore();
	const { togglePublicChatDocument, selectedPublicChatDocuments } =
		usePublicDocumentsStore();

	const isSelectedForAction = selectedUserDocumentsForAction.some(
		(doc) => doc.id === item.id,
	);
	const isSelectedForChat =
		selectedUserChatDocuments.some((doc) => doc.id === item.id) ||
		selectedPublicChatDocuments.some((doc) => doc.id === item.id);

	const isSelectedForPreview = selectedPreviewDocument?.id === item.id;

	const handleCheckboxChange = (checked: boolean) => {
		if (isPublicDocument(item)) {
			return;
		}

		if (checked) {
			selectUserDocumentForAction(item);
			return;
		}

		unselectUserDocumentForAction(item.id);
	};

	const handleToggleChatItem = () => {
		if (isUserDocument(item)) {
			toggleUserChatDocument(item);
			return;
		}

		if (isPublicDocument(item)) {
			togglePublicChatDocument(item);
			return;
		}
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
					handleToggleChatItem={handleToggleChatItem}
					isSelectedForChat={isSelectedForChat}
				/>
				<ItemDropdownButton item={item} />
			</div>
		</div>
	);
};

export default DocumentItem;
