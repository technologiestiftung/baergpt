import React from "react";
import type { DocumentFolder } from "../../../../common";
import { useFolderStore } from "../../../../store/folder-store";
import Checkbox from "../../../primitives/checkboxes/checkbox.tsx";
import { DroppableFolderName } from "./droppable-folder-name.tsx";
import { useMobileMenuStore } from "../../../../store/use-mobile-menu.ts";
import Content from "../../../../content.ts";
import { ToggleChatItemButton } from "./toggle-chat-item-button.tsx";

interface FolderItemProps {
	item: DocumentFolder;
}

const FolderItem: React.FC<FolderItemProps> = ({ item }) => {
	const {
		selectedChatFolders,
		selectedFoldersForAction,
		selectChatFolder,
		selectFolderForAction,
		unselectChatFolder,
		unselectFolderForAction,
	} = useFolderStore();
	const { isMobileCheckboxVisible } = useMobileMenuStore();

	const isSelectedForAction = selectedFoldersForAction.some(
		(folder) => folder.id === item.id,
	);
	const isSelectedForChat = selectedChatFolders.some(
		(folder) => folder.id === item.id,
	);

	const handleCheckboxChange = (checked: boolean) => {
		if (checked) {
			selectFolderForAction(item);
			return;
		}
		unselectFolderForAction(item.id);
	};

	const handleToggleChatFolder = (folder: DocumentFolder) => {
		if (selectedChatFolders.some((fol) => fol.id === folder.id)) {
			unselectChatFolder(folder.id);
			return;
		}
		selectChatFolder(folder);
	};

	return (
		<>
			<div className={`${isMobileCheckboxVisible ? "flex" : "hidden"} md:flex`}>
				<Checkbox
					id={`${item.id.toString()}-folder`}
					checked={isSelectedForAction}
					onChange={handleCheckboxChange}
					ariaLabel={Content["documentsList.folder.checkbox.ariaLabel"]}
				/>
			</div>

			<div
				className={`h-11 pl-2.5 gap-x-2 flex justify-between items-center w-0 grow hover:bg-hellblau-55 group ${isSelectedForChat && "bg-hellblau-60"}`}
			>
				<DroppableFolderName item={item} />

				<ToggleChatItemButton
					handleToggleChatItem={() => handleToggleChatFolder(item)}
					isSelectedForChat={isSelectedForChat}
				/>
			</div>
		</>
	);
};

export default FolderItem;
