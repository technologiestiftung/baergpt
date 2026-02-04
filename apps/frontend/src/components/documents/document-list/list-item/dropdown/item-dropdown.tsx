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

type DropdownAction = "addToChat" | "view" | "delete";

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

	const handleActionSelect = (action: DropdownAction) => {
		onClose();

		switch (action) {
			case "addToChat": {
				if (isDoc) {
					toggleChatDocument(item as Document);
				} else {
					toggleChatFolder(item as DocumentFolder);
				}
				break;
			}
			case "view":
				selectPreviewDocument(item as Document);
				break;
			case "delete":
				setItemToDelete(item);
				showDeleteDialog(deleteDialogId);
				break;
			default:
				break;
		}
	};

	const dropdownItems = [
		{
			action: "addToChat" as const,
			label: isSelectedForChat
				? Content["documentsList.removeFromChat"]
				: Content["documentsList.addToChat"],
			icon: "/icons/plus-dark-blue-icon.svg",
			ariaLabel: isSelectedForChat
				? Content["documentsList.removeFromChat"]
				: Content["documentsList.addToChat"],
			imgAlt: isSelectedForChat
				? Content["documentsList.removeFromChat.imgAlt"]
				: Content["documentsList.addToChat.imgAlt"],
			isDestructive: false,
		},
		...(isDoc
			? [
					{
						action: "view" as const,
						label: Content["documentsList.view"],
						icon: "/icons/eye-preview-icon.svg",
						ariaLabel: Content["documentsList.view"],
						imgAlt: Content["documentsList.view.imgAlt"],
						isDestructive: false,
					},
				]
			: []),
		{
			action: "delete" as const,
			label: Content["documentsList.delete"],
			ariaLabel: isDoc
				? Content["documentsList.deleteDocument"]
				: Content["documentsList.deleteFolder"],
			isDestructive: true,
		},
	];

	const { optionButtonRefs, handleKeyDown } = useDropdownKeyboard({
		items: dropdownItems,
		isOpen,
		onClose,
		onItemClick: (dropdownItem) => handleActionSelect(dropdownItem.action),
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
							<li key={dropdownItem.action}>
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
									${dropdownItem.action === "delete" ? "group/delete text-warning-100 hover:text-dunkelblau-80" : "text-dunkelblau-80"}`}
									onClick={() => handleActionSelect(dropdownItem.action)}
									aria-label={dropdownItem.ariaLabel}
									role="option"
								>
									<div className="flex items-center justify-center rounded-3px shrink-0 size-8 relative">
										{dropdownItem.action === "delete" ? (
											<DeleteElementIcon />
										) : (
											<img
												src={dropdownItem.icon}
												alt={dropdownItem.imgAlt}
												className="size-5"
												width={20}
												height={20}
											/>
										)}
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
