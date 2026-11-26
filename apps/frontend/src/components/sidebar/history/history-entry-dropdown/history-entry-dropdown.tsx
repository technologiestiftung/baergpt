import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { useDropdownKeyboard } from "../../../../hooks/use-dropdown-keyboard";
import { useIsMobile } from "../../../../hooks/use-mobile.tsx";
import useExportDropdownPosition from "../../../chat/hooks/use-export-dropdown-position.ts";
import Content from "../../../../content";
import type { Chat } from "../../../../common";
import {
	showDeleteHistoryEntryDialog,
	showDeleteSelectedHistoryEntriesDialog,
} from "../delete-history-entry/delete-history-entries-dialog";
import { useSelectedChatCount } from "../../../../store/use-history-selection-store";
import { BucketIcon } from "../../../primitives/icons/bucket-icon.tsx";

interface HistoryEntryDropdownProps {
	chat: Chat;
	isOpen: boolean;
	onClose: () => void;
	onRename: () => void;
	triggerRef: React.RefObject<HTMLButtonElement | null>;
	menuRef: React.RefObject<HTMLDivElement | null>;
}

export const HistoryEntryDropdown: React.FC<HistoryEntryDropdownProps> = ({
	chat,
	isOpen,
	onClose,
	onRename,
	triggerRef,
	menuRef,
}) => {
	const selectedChatCount = useSelectedChatCount(chat.id);
	const isMobile = useIsMobile();
	const { coords, updateCoords } = useExportDropdownPosition(
		triggerRef,
		menuRef,
		isMobile ? "right" : "left",
	);

	useEffect(() => {
		if (isOpen) {
			updateCoords();

			const handleScroll = () => {
				updateCoords();
			};

			const scrollContainer = document.querySelector(".history-scrollbar");
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
	}, [isOpen, triggerRef, isMobile]);

	const handleRename = () => {
		onClose();
		onRename();
	};

	const handleDelete = () => {
		onClose();
		showDeleteHistoryEntryDialog(chat.id, chat.name);
	};

	const handleDeleteSelected = () => {
		onClose();
		showDeleteSelectedHistoryEntriesDialog();
	};

	const deleteSelectedItem = {
		action: handleDeleteSelected,
		label: Content["historyEntryDropdown.selection.delete"].replace(
			"{count}",
			String(selectedChatCount),
		),
		style: "hover:bg-warning-50 text-warning-120",
		icon: <BucketIcon className="size-5" />,
	};

	const singleChatItems = [
		{
			action: handleRename,
			label: Content["historyEntryDropdown.rename"],
			style: "text-dunkelblau-80",
			icon: (
				<img
					src="/icons/edit-dark-blue-icon.svg"
					alt={Content["historyEntryDropdown.rename.imgAlt"]}
					className="size-5"
					width={20}
					height={20}
				/>
			),
		},
		{
			action: handleDelete,
			label: Content["historyEntryDropdown.delete"],
			style: "hover:bg-warning-50 text-warning-120",
			icon: <BucketIcon className="size-5" />,
		},
	];

	const isSelectionMenu = selectedChatCount > 1;
	const dropdownItems = isSelectionMenu
		? [deleteSelectedItem]
		: singleChatItems;

	const { optionButtonRefs, handleKeyDown } = useDropdownKeyboard({
		items: dropdownItems,
		isOpen,
		onClose,
		onItemClick: (item) => item.action(),
	});

	if (!isOpen) {
		return null;
	}

	return createPortal(
		<div
			ref={menuRef}
			className={`fixed z-[70] w-fit rounded-3px shadow-custom-shadow shadow-dunkelblau-100/10 p-1 bg-hellblau-30`}
			style={{ top: coords?.top, left: coords?.left }}
			onKeyDown={handleKeyDown}
			role="listbox"
		>
			<ul className="flex flex-col">
				{dropdownItems.map((item, index) => (
					<li key={item.label}>
						<button
							type="button"
							ref={(el) => {
								if (el) {
									optionButtonRefs.current.set(index, el);
								} else {
									optionButtonRefs.current.delete(index);
								}
							}}
							className={`flex items-center w-full text-left rounded-3px focus-visible:outline-2px gap-x-1 py-2 px-3 ${item.style}`}
							onClick={item.action}
							aria-label={item.label}
							role="option"
						>
							<div
								className={`flex items-center justify-center rounded-3px shrink-0`}
							>
								{item.icon}
							</div>
							<span className="text-sm leading-5">{item.label}</span>
						</button>
					</li>
				))}
			</ul>
		</div>,
		document.body,
	);
};
