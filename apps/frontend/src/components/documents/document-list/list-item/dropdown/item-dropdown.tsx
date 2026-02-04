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

	const deleteDialogId = `delete-dialog-${isDoc ? "doc" : "folder"}-${item.id}`;

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
				? Content["documentsList.RemoveFromChat"]
				: Content["documentsList.AddToChat"],
			icon: "/icons/plus-dark-blue-icon.svg",
			ariaLabel: isDoc
				? "Dokument zum Chat hinzufügen"
				: "Ordner zum Chat hinzufügen",
			imgAlt: "Plus-Icon",
			isDestructive: false,
		},
		...(isDoc
			? [
					{
						action: "view" as const,
						label: "Anzeigen",
						icon: "/icons/visibility-icon.svg",
						ariaLabel: "Dokument anzeigen",
						imgAlt: "Anzeigen-Icon",
						isDestructive: false,
					},
				]
			: []),
		{
			action: "delete" as const,
			label: "Löschen",
			icon: "/icons/bucket-red-icon.svg",
			ariaLabel: isDoc ? "Dokument löschen" : "Ordner löschen",
			imgAlt: "Mülleimer-Icon",
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
					className="absolute top-full right-0 z-50 bg-white rounded-3px shadow-base min-w-[200px]"
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
									className="flex items-center w-full h-9 px-1.5 py-1 gap-x-2 text-left hover:bg-hellblau-30 focus-visible:outline-default focus-visible:-outline-offset-1 rounded-3px"
									onClick={() => handleActionSelect(dropdownItem.action)}
									aria-label={dropdownItem.ariaLabel}
									role="option"
								>
									<div className="flex items-center justify-center rounded-3px shrink-0 size-8">
										<img
											src={dropdownItem.icon}
											alt={dropdownItem.imgAlt}
											className="size-5"
											width={20}
											height={20}
										/>
									</div>
									<span
										className={`text-sm leading-5 ${
											dropdownItem.isDestructive
												? "text-warning-100"
												: "text-dunkelblau-80"
										}`}
									>
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
