import React from "react";
import { FolderIcon } from "../../primitives/icons/folder-icon.tsx";
import { DocumentIcon } from "../../primitives/icons/document-icon.tsx";
import { isDocument } from "../../documents/document-list/list-item/utils/is-document.ts";
import { getListItemName } from "../../documents/document-list/list-item/utils/get-list-item-name.ts";
import type { ListItem } from "../../documents/document-list/list-item/utils/types.ts";
import { getUniqueId } from "../../documents/document-list/list-item/utils/get-unique-id.ts";

interface SelectedItemProps {
	items: ListItem[];
}

export const ChatItemPills: React.FC<SelectedItemProps> = ({ items }) => {
	return (
		<div className="flex flex-wrap gap-3 justify-end w-full">
			{items.map((item) => (
				<div
					key={getUniqueId(item)}
					className="flex items-center gap-x-1 rounded-[3px] bg-hellblau-30 pl-2 pr-[11px] py-1.5 shadow-[0px_0px_3px_0px_rgba(12,39,83,0.20)] text-dunkelblau-100 w-full md:w-fit"
				>
					{isDocument(item) ? (
						<DocumentIcon className="size-5" variant="darkBlue" />
					) : (
						<FolderIcon className="size-5" variant="darkblue" />
					)}
					<span className="text-sm leading-5 font-normal min-w-0 grow max-w-44 truncate text-dunkelblau-100">
						{getListItemName(item)}
					</span>
				</div>
			))}
		</div>
	);
};
