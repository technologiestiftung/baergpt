import React from "react";
import { ListItem } from "./list-item/list-item";
import { useFolderStore } from "../../../store/folder-store";
import { useDocumentStore } from "../../../store/document-store";
import DocumentListSkeleton from "../../primitives/skeletons/document-list-skeleton";
import { MultiSelectForAction } from "./multi-select-for-action/multi-select-for-action.tsx";
import { getSortedItems } from "./list-item/utils/get-sorted-items.ts";
import { getUniqueId } from "./list-item/utils/get-unique-id.ts";
import { useMobileMenuStore } from "../../../store/use-mobile-menu.ts";
import { isDocument } from "./list-item/utils/is-document.ts";

export const DocumentsList: React.FC = () => {
	const { isFolderFirstLoad, getItemsInCurrentFolder } = useFolderStore();
	const { isDocumentFirstLoad, isLoading, deletedDefaultDocumentIds } =
		useDocumentStore();
	const { isMobileCheckboxVisible } = useMobileMenuStore();

	const isFirstLoad = isDocumentFirstLoad || isFolderFirstLoad;

	const itemsInCurrentFolder = getItemsInCurrentFolder();

	const sortedItems = getSortedItems(itemsInCurrentFolder);

	// Filter out deleted default documents by ID
	const filteredItems = sortedItems.filter(
		(item) => !isDocument(item) || !deletedDefaultDocumentIds.includes(item.id),
	);

	return (
		<div className="flex flex-col w-full h-full">
			<div className="flex flex-row justify-between items-center h-11 gap-3 px-2 md:pr-2 md:pl-0 py-1.5 border-b-[0.5px] border-b-hellblau-110">
				<MultiSelectForAction />

				<div
					className={`md:flex items-center gap-2 ${isMobileCheckboxVisible ? "hidden" : "flex"}`}
				>
					{/* Placeholder for delete button */}
				</div>
			</div>

			<div className="flex flex-col w-full h-full">
				<ul
					className="grow h-0 overflow-y-auto mt-2 md:mt-0 pl-2 md:pl-0 filesection-scrollbar"
					style={{ scrollbarGutter: "stable" }}
				>
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
