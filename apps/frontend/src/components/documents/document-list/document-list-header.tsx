import React from "react";
import { useFolderStore } from "../../../store/folder-store";
import { useDocumentStore } from "../../../store/document-store";
import { useDocumentsListStore } from "../../../store/use-documents-list-store.ts";
import { DeleteItemButton } from "../delete-item/delete-item-button.tsx";
import Content from "../../../content";

export const DocumentListHeader: React.FC = () => {
	const { selectedFoldersForAction } = useFolderStore();
	const { selectedDocumentsForAction } = useDocumentStore();
	const { isMultiSelectForActionVisible } = useDocumentsListStore();

	const selectedItemsForAction = [
		...selectedFoldersForAction,
		...selectedDocumentsForAction,
	];
	return (
		<div className="flex flex-row justify-between items-center h-11 gap-3 md:pr-0 pl-5 md:pl-2.5 py-3 border-b-[0.5px] border-b-hellblau-110">
			{selectedItemsForAction.length > 0 ? (
				<div className="text-sm leading-5 font-semibold text-dunkelblau-100">
					{Content["documentsList.name"]}{" "}
					<span className="font-normal">
						( {selectedItemsForAction.length}{" "}
						{Content["documentsList.selectedItemsCount.label"]} )
					</span>
				</div>
			) : (
				<div className="text-sm leading-5 font-semibold text-dunkelblau-100">
					{Content["documentsList.name"]}
				</div>
			)}
			{isMultiSelectForActionVisible && <DeleteItemButton />}
		</div>
	);
};
