import React from "react";
import type { DocumentFolder } from "../../../../common";
import { useFolderStore } from "../../../../store/folder-store";
import { useDocumentsListStore } from "../../../../store/use-documents-list-store.ts";
import Checkbox from "../../../primitives/checkboxes/checkbox.tsx";
import { DroppableFolderName } from "./droppable-folder-name.tsx";
import Content from "../../../../content.ts";
import { ToggleChatItemButton } from "./toggle-chat-item-button.tsx";
import { ItemDropdownButton } from "./dropdown/item-dropdown-button.tsx";

interface FolderItemProps {
	item: DocumentFolder;
}

const FolderItem: React.FC<FolderItemProps> = ({ item }) => {
	const {
		selectedChatFolders,
		selectedFoldersForAction,
		selectFolderForAction,
		unselectFolderForAction,
		toggleChatFolder,
	} = useFolderStore();

	const { isMultiSelectForActionVisible } = useDocumentsListStore();

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

	return (
		<div className="flex gap-x-2 items-center pl-5 md:pl-2.5">
			<div className={isMultiSelectForActionVisible ? "flex" : "hidden"}>
				<Checkbox
					id={`${item.id.toString()}-folder`}
					checked={isSelectedForAction}
					onChange={handleCheckboxChange}
					ariaLabel={Content["documentsList.folder.checkbox.ariaLabel"]}
				/>
			</div>

			<div
				className={`h-11 gap-x-1 flex justify-between items-center w-0 grow hover:bg-hellblau-55 group ${isSelectedForChat && "bg-hellblau-60"}`}
			>
				<DroppableFolderName item={item} />

				<ToggleChatItemButton
					handleToggleChatItem={() => toggleChatFolder(item)}
					isSelectedForChat={isSelectedForChat}
				/>

				<ItemDropdownButton item={item} />
			</div>
		</div>
	);
};

export default FolderItem;
