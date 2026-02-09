import React, { useState } from "react";
import { useDropdownKeyboard } from "../../../../../hooks/use-dropdown-keyboard";
import { useDocumentStore } from "../../../../../store/document-store";
import { useFolderStore } from "../../../../../store/folder-store";
import type { Document, DocumentFolder } from "../../../../../common";
import Content from "../../../../../content";
import { isDocument } from "../utils/is-document";
import {
	DeleteItemDialog,
	showDeleteDialog,
} from "../../../delete-item/delete-item-dialog";
import { DeleteElementIcon } from "../../../../primitives/icons/delete-element-icon";

interface ItemDropdownProps {
	item: Document | DocumentFolder;
	isOpen: boolean;
	onClose: () => void;
}

export const ItemDropdown: React.FC<ItemDropdownProps> = ({
	item,
	isOpen,
	onClose,
}) => {
	const { selectedChatDocuments, toggleChatDocument, selectPreviewDocument } =
		useDocumentStore();
	const { selectedChatFolders, toggleChatFolder } = useFolderStore();

	const [itemToDelete, setItemToDelete] = useState<
		Document | DocumentFolder | null
	>(null);

	const isDoc = isDocument(item);
	const isSelectedForChat = isDoc
		? selectedChatDocuments.some((doc) => doc.id === item.id)
		: selectedChatFolders.some((fol) => fol.id === item.id);

	const deleteDialogId = `dropdown-${isDoc ? "doc" : "folder"}-${item.id}`;

	const handleAddToChat = () => {
		onClose();
		if (isDoc) {
			toggleChatDocument(item as Document);
		} else {
			toggleChatFolder(item as DocumentFolder);
		}
	};

	const handleDeleteItem = () => {
		onClose();
		setItemToDelete(item);
		showDeleteDialog(deleteDialogId);
	};

	const handleViewItem = () => {
		onClose();
		selectPreviewDocument(item as Document);
	};

	const toggleContentKey = isSelectedForChat ? "removeFromChat" : "addToChat";

	const addToChatItem = {
		action: handleAddToChat,
		label: Content[`documentsList.${toggleContentKey}`],
		ariaLabel: Content[`documentsList.${toggleContentKey}`],
		imgAlt: Content[`documentsList.${toggleContentKey}.imgAlt`],
		style: "text-dunkelblau-80",
		icon: (
			<img
				src={
					isSelectedForChat
						? "/icons/minus-dark-blue-icon.svg"
						: "/icons/plus-dark-blue-icon.svg"
				}
				alt={Content[`documentsList.${toggleContentKey}.imgAlt`]}
				className="size-5"
				width={20}
				height={20}
			/>
		),
	};

	const viewItem = {
		action: handleViewItem,
		label: Content["documentsList.view"],
		ariaLabel: Content["documentsList.view"],
		imgAlt: Content["documentsList.view.imgAlt"],
		style: "text-dunkelblau-80",
		icon: (
			<img
				src="/icons/eye-preview-icon.svg"
				alt={Content["documentsList.view.imgAlt"]}
				className="size-5"
				width={20}
				height={20}
			/>
		),
	};

	const deleteItemKey = isDoc ? "deleteDocument" : "deleteFolder";

	const deleteItem = {
		action: handleDeleteItem,
		label: Content["documentsList.delete"],
		ariaLabel: Content[`documentsList.${deleteItemKey}`],
		style: "group/delete text-warning-100 hover:text-dunkelblau-80",
		icon: <DeleteElementIcon />,
	};

	const dropdownItems = [
		addToChatItem,
		...(isDoc ? [viewItem] : []),
		deleteItem,
	];

	const { optionButtonRefs, handleKeyDown } = useDropdownKeyboard({
		items: dropdownItems,
		isOpen,
		onClose,
		onItemClick: (dropdownItem) => dropdownItem.action,
	});

	return (
		<>
			{isOpen && (
				<div
					className="absolute top-full right-0 z-50 bg-white rounded-3px shadow-md min-w-[200px]"
					onKeyDown={handleKeyDown}
					role="listbox"
				>
					<ul className="flex flex-col">
						{dropdownItems.map((dropdownItem, index) => (
							<li key={dropdownItem.label}>
								<button
									type="button"
									ref={(el) => {
										if (el) {
											optionButtonRefs.current.set(index, el);
										} else {
											optionButtonRefs.current.delete(index);
										}
									}}
									className={`flex items-center w-full h-9 px-1.5 py-1 gap-x-2 text-left hover:bg-hellblau-50 focus-visible:outline-2px rounded-3px
										${dropdownItem.style}`}
									onClick={dropdownItem.action}
									aria-label={dropdownItem.ariaLabel}
									role="option"
								>
									<div className="flex items-center justify-center rounded-3px shrink-0 size-8 relative">
										{dropdownItem.icon}
									</div>
									<span className={`text-sm leading-5 `}>
										{dropdownItem.label}
									</span>
								</button>
							</li>
						))}
					</ul>
				</div>
			)}

			<DeleteItemDialog
				id={deleteDialogId}
				dropdownItemToDelete={itemToDelete as Document | DocumentFolder}
			/>
		</>
	);
};
