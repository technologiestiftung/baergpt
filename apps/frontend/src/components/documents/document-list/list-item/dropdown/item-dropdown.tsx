import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useDropdownKeyboard } from "../../../../../hooks/use-dropdown-keyboard";
import { useIsMobile } from "../../../../../hooks/use-mobile.tsx";
import { usePreviewDocumentStore } from "../../../../../store/use-preview-document-store.ts";
import type { Document, PublicFolder, UserFolder } from "../../../../../common";
import Content from "../../../../../content";
import { isDocument } from "../utils/is-document";
import { toggleItemInChat } from "../utils/toggle-item-in-chat";
import { isItemSelectedForChat } from "../utils/is-item-selected-for-chat";
import { showDeleteDialog } from "../../../delete-item/delete-item-dialog";
import { BucketIcon } from "../../../../primitives/icons/bucket-icon";
import { useDocumentsListStore } from "../../../../../store/use-documents-list-store";
import { isPublicFolder } from "../utils/is-public-folder.ts";
import { isPublicDocument } from "../utils/is-public-document.ts";
import { isUserFolder } from "../utils/is-user-folder.ts";
import { showRenameFolderDialog } from "../../../rename-folder/rename-folder-dialog.tsx";
import { isPersonalDocument } from "../utils/is-personal-document.ts";
import { showRenameDocumentDialog } from "../../../rename-document/rename-document-dialog.tsx";
import { useDocumentDownloadStore } from "../../../../../store/use-document-download-store.ts";

interface ItemDropdownProps {
	item: Document | UserFolder | PublicFolder;
	isOpen: boolean;
	onClose: () => void;
	triggerRef: React.RefObject<HTMLButtonElement | null>;
	menuRef: React.RefObject<HTMLDivElement | null>;
}

export const ItemDropdown: React.FC<ItemDropdownProps> = ({
	item,
	isOpen,
	onClose,
	triggerRef,
	menuRef,
}) => {
	const { selectPreviewDocument } = usePreviewDocumentStore();
	const { setSingleItemSelectedForAction } = useDocumentsListStore();
	const { downloadDocumentFile } = useDocumentDownloadStore();
	const [position, setPosition] = useState<{
		top: number;
		right: number;
	}>({ top: 0, right: 0 });
	const isMobile = useIsMobile();

	const isDoc = isDocument(item);
	const isSelectedForChat = isItemSelectedForChat(item);
	const isReadOnly =
		isPublicFolder(item) || (isDoc && item.source_type === "public_document");
	const isRenamable = isUserFolder(item) || isPersonalDocument(item);

	const calculatePosition = () => {
		if (triggerRef.current) {
			const rect = triggerRef.current.getBoundingClientRect();
			return {
				top: rect.bottom,
				right: window.innerWidth - rect.right,
			};
		}
		return { top: 0, right: 0 };
	};

	useEffect(() => {
		if (isOpen) {
			setPosition(calculatePosition());

			const handleScroll = () => {
				setPosition(calculatePosition());
			};

			const scrollContainer = document.querySelector(".filesection-scrollbar");
			if (scrollContainer) {
				scrollContainer.addEventListener("scroll", handleScroll);
			}

			return () => {
				if (scrollContainer) {
					scrollContainer.removeEventListener("scroll", handleScroll);
				}
			};
		}
		return undefined;
	}, [isOpen, triggerRef]);

	useEffect(() => {
		if (isOpen) {
			onClose();
		}
	}, [isMobile]);

	const handleAddToChat = () => {
		onClose();
		toggleItemInChat(item);
	};

	const handleDeleteItem = (
		itemToDelete: Document | UserFolder | PublicFolder,
	) => {
		if (isPublicFolder(itemToDelete) || isPublicDocument(itemToDelete)) {
			return;
		}

		onClose();
		setSingleItemSelectedForAction(itemToDelete);
		showDeleteDialog();
	};

	const handleViewItem = () => {
		onClose();
		selectPreviewDocument(item as Document);
	};

	const handleDownloadItem = () => {
		onClose();
		void downloadDocumentFile(item as Document);
	};

	const handleRenameItem = () => {
		if (!isRenamable) {
			return;
		}

		onClose();
		setSingleItemSelectedForAction(item);
		if (isUserFolder(item)) {
			showRenameFolderDialog();
		} else {
			showRenameDocumentDialog();
		}
	};

	const toggleContentKey = isSelectedForChat ? "removeFromChat" : "addToChat";
	const deleteItemKey = isDoc ? "deleteDocument" : "deleteFolder";
	const renameItemKey = isDoc ? "renameDocument" : "renameFolder";

	const addToChatItem = {
		action: handleAddToChat,
		label: Content[`documentsList.${toggleContentKey}`],
		ariaLabel: Content[`documentsList.${toggleContentKey}`],
		style: "text-dunkelblau-80",
		icon: (
			<img
				src={
					isSelectedForChat
						? "/icons/minus-small-dark-blue-icon.svg"
						: "/icons/plus-small-dark-blue-icon.svg"
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

	const downloadItem = {
		action: handleDownloadItem,
		label: Content["documentsList.download"],
		ariaLabel: Content["documentsList.download"],
		style: "text-dunkelblau-80",
		icon: (
			<img
				src="/icons/download-icon.svg"
				alt={Content["downloadIcon.imgAlt"]}
				className="size-5"
				width={20}
				height={20}
			/>
		),
	};

	const renameItem = {
		action: handleRenameItem,
		label: Content["documentsList.rename"],
		ariaLabel: Content[`documentsList.${renameItemKey}`],
		style: "text-dunkelblau-80",
		icon: (
			<img
				src="/icons/edit-dark-blue-icon.svg"
				alt={Content["documentsList.rename.imgAlt"]}
				className="size-5"
				width={20}
				height={20}
			/>
		),
	};

	const deleteItem = {
		action: () => handleDeleteItem(item),
		label: Content["documentsList.delete"],
		ariaLabel: Content[`documentsList.${deleteItemKey}`],
		style: "group/delete text-warning-120 hover:bg-warning-50",
		icon: <BucketIcon className="size-5" />,
	};

	const dropdownItems = [
		addToChatItem,
		...(isRenamable ? [renameItem] : []),
		...(isDoc ? [viewItem, downloadItem] : []),
		...(isReadOnly ? [] : [deleteItem]),
	];

	const { optionButtonRefs, handleKeyDown } = useDropdownKeyboard({
		items: dropdownItems,
		isOpen,
		onClose,
		onItemClick: (dropdownItem) => dropdownItem.action(),
	});

	if (!isOpen) {
		return null;
	}

	return createPortal(
		<div
			ref={menuRef}
			className="fixed z-[70] bg-white rounded-3px shadow-md min-w-[200px] p-1"
			style={{
				top: `${position.top}px`,
				right: `${position.right}px`,
			}}
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
							className={`flex items-center w-full px-3 py-2 gap-x-1 text-left hover:bg-hellblau-50 focus-visible:outline-2px rounded-3px
								${dropdownItem.style}`}
							onClick={dropdownItem.action}
							aria-label={dropdownItem.ariaLabel}
							role="option"
						>
							<div className="flex items-center justify-center rounded-3px shrink-0 size-5 relative">
								{dropdownItem.icon}
							</div>
							<span className={`text-sm leading-5 `}>{dropdownItem.label}</span>
						</button>
					</li>
				))}
			</ul>
		</div>,
		document.body,
	);
};
