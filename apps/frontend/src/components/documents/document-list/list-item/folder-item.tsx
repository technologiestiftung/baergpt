import React from "react";
import type { UserFolder } from "../../../../common";
import { useUserFolderStore } from "../../../../store/use-user-folder-store.ts";
import { useDocumentsListStore } from "../../../../store/use-documents-list-store.ts";
import Checkbox from "../../../primitives/checkboxes/checkbox.tsx";
import { DroppableFolderName } from "./droppable-folder-name.tsx";
import Content from "../../../../content.ts";
import { ToggleChatItemButton } from "./toggle-chat-item-button.tsx";
import { ItemDropdownButton } from "./dropdown/item-dropdown-button.tsx";
import { usePublicDocumentsStore } from "../../../../store/use-public-documents-store.ts";
import { isUserFolder } from "./utils/is-user-folder.ts";
import { isPublicFolder } from "./utils/is-public-folder.ts";

interface FolderItemProps {
	item: UserFolder;
}

const FolderItem: React.FC<FolderItemProps> = ({ item }) => {
	const {
		selectedUserChatFolders,
		selectedUserFoldersForAction,
		selectUserFolderForAction,
		unselectFolderForAction,
		toggleUserChatFolder,
	} = useUserFolderStore();
	const { togglePublicChatFolder } = usePublicDocumentsStore();

	const { isMultiSelectForActionVisible } = useDocumentsListStore();

	const isSelectedForAction = selectedUserFoldersForAction.some(
		(folder) => folder.id === item.id,
	);
	const isSelectedForChat = selectedUserChatFolders.some(
		(folder) => folder.id === item.id,
	);

	const handleCheckboxChange = (checked: boolean) => {
		if (checked) {
			selectUserFolderForAction(item);
			return;
		}
		unselectFolderForAction(item.id);
	};

	const handleToggleChatItem = () => {
		if (isUserFolder(item)) {
			toggleUserChatFolder(item);
			return;
		}

		if (isPublicFolder(item)) {
			togglePublicChatFolder(item);
			return;
		}
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
					handleToggleChatItem={handleToggleChatItem}
					isSelectedForChat={isSelectedForChat}
				/>

				<ItemDropdownButton item={item} />
			</div>
		</div>
	);
};

export default FolderItem;
