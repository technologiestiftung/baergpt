import React from "react";
import { useFolderStore } from "../../../store/folder-store";
import { useDocumentStore } from "../../../store/document-store";
import { SelectedItemPill } from "./selected-item-pill";
import { SelectedChatItemsLabel } from "./selected-chat-items-label.tsx";
import { useIsCollapsibleOpen } from "./hooks/use-is-collapsible-open.tsx";
import { getListItemName } from "../../documents/document-list/list-item/utils/get-list-item-name.ts";

export const SelectedChatItemsCollapsible: React.FC = () => {
	const { selectedChatFolders, unselectChatFolder } = useFolderStore();
	const { selectedChatDocuments, unselectChatDocument } = useDocumentStore();

	const hasSelectedChatItems =
		selectedChatFolders.length > 0 || selectedChatDocuments.length > 0;

	const [isCollapsibleOpen, setIsCollapsibleOpen] = useIsCollapsibleOpen();

	return (
		<button
			type="button"
			disabled={!hasSelectedChatItems}
			onClick={() => setIsCollapsibleOpen(!isCollapsibleOpen)}
			className={`
				flex flex-col items-start justify-center gap-y-3 w-full px-4 py-1.5
				bg-hellblau-30 rounded-t-3px text-sm leading-5 text-dunkelblau-80
				focus-visible:outline-2px ${hasSelectedChatItems && "hover:bg-hellblau-50"} ${isCollapsibleOpen && "pb-3"}`}
		>
			<SelectedChatItemsLabel />

			{isCollapsibleOpen && (
				<div className="flex flex-wrap gap-2">
					{selectedChatFolders.map((item) => (
						<SelectedItemPill
							key={`${item.id}-${item.name}`}
							id={item.id}
							name={getListItemName(item)}
							isFolder={true}
							onRemove={unselectChatFolder}
						/>
					))}

					{selectedChatDocuments.map((item) => (
						<SelectedItemPill
							key={`${item.id}-${item.file_name}`}
							id={item.id}
							name={getListItemName(item)}
							isFolder={false}
							onRemove={unselectChatDocument}
						/>
					))}
				</div>
			)}
		</button>
	);
};
