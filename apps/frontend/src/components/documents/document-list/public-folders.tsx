import { FolderIcon } from "../../primitives/icons/folder-icon.tsx";
import { ToggleChatItemButton } from "./list-item/toggle-chat-item-button.tsx";
import Content from "../../../content.ts";
import { usePublicDocumentsStore } from "../../../store/use-public-documents-store.ts";
import { useCurrentFolderStore } from "../../../store/use-current-folder-store.ts";
import { ItemDropdownButton } from "./list-item/dropdown/item-dropdown-button.tsx";

export function PublicFolders() {
	const {
		publicFolders: [baseKnowledgeFolder],
		selectedPublicChatFolders,
		togglePublicChatFolder,
	} = usePublicDocumentsStore();
	const { setCurrentFolder } = useCurrentFolderStore();

	return (
		<>
			<h2 className="md:mt-4 pl-0.5 leading-6 text-dunkelblau-100">
				{Content["documentSection.publicFolder.label"]}
			</h2>
			<ul
				className={`mt-2 flex items-center w-full hover:bg-hellblau-55 group`}
			>
				<li className="flex items-center w-full border-y-[0.5px] border-y-hellblau-110">
					<button
						className={`flex h-11 pl-5 md:pl-2.5 w-0 items-center grow gap-x-1 rounded-3px focus-visible:outline-default`}
						onClick={() => setCurrentFolder(baseKnowledgeFolder)}
					>
						<FolderIcon variant="default" />
						<span className="truncate text-sm leading-5 font-normal text-dunkelblau-100">
							{baseKnowledgeFolder.name}
						</span>
					</button>
					<ToggleChatItemButton
						handleToggleChatItem={() =>
							togglePublicChatFolder(baseKnowledgeFolder)
						}
						isSelectedForChat={selectedPublicChatFolders.some(
							(folder) => folder.id === baseKnowledgeFolder.id,
						)}
					/>

					<div className="md:hidden">
						<ItemDropdownButton item={baseKnowledgeFolder} />
					</div>
				</li>
			</ul>
		</>
	);
}
