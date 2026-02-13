import React from "react";
import { ListItem } from "./list-item/list-item";
import { useFolderStore } from "../../../store/folder-store";
import { useDocumentStore } from "../../../store/document-store";
import DocumentListSkeleton from "../../primitives/skeletons/document-list-skeleton";
import { getSortedItems } from "./list-item/utils/get-sorted-items.ts";
import { getUniqueId } from "./list-item/utils/get-unique-id.ts";
import { isDocument } from "./list-item/utils/is-document.ts";
import { DocumentListHeader } from "./document-list-header.tsx";

export const DocumentsList: React.FC = () => {
	const { isFolderFirstLoad, getItemsInCurrentFolder } = useFolderStore();
	const { isDocumentFirstLoad, isLoading, deletedDefaultDocumentIds } =
		useDocumentStore();

	const isFirstLoad = isDocumentFirstLoad || isFolderFirstLoad;

	const itemsInCurrentFolder = getItemsInCurrentFolder();

	const sortedItems = getSortedItems(itemsInCurrentFolder);

	// Filter out deleted default documents by ID
	const filteredItems = sortedItems.filter(
		(item) => !isDocument(item) || !deletedDefaultDocumentIds.includes(item.id),
	);

	return (
		<div className="flex flex-col w-full h-full">
			<DocumentListHeader />

			<div className="flex flex-col w-full h-full">
				<ul className="grow h-0 overflow-y-auto mt-2 md:mt-0 filesection-scrollbar">
					{(isFirstLoad || isLoading) && <DocumentListSkeleton count={8} />}

					{!isFirstLoad &&
						!isLoading &&
						filteredItems.map((item) => (
							<ListItem key={getUniqueId(item)} item={item} />
						))}
				</ul>
			</div>
		</div>
	);
};
