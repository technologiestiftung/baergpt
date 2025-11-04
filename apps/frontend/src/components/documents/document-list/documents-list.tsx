import React from "react";
import { ListItem } from "./list-item/list-item";
import { useFolderStore } from "../../../store/folder-store";
import { useDocumentStore } from "../../../store/document-store";
import DocumentListSkeleton from "../../primitives/skeletons/document-list-skeleton";
import { MultiSelectForAction } from "./multi-select-for-action/multi-select-for-action.tsx";
import { AddToChatIcon } from "../../primitives/icons/add-to-chat-icon.tsx";
import { getSortedItems } from "./list-item/utils/get-sorted-items.ts";
import { getUniqueId } from "./list-item/utils/get-unique-id.ts";
import { useMobileMenuStore } from "../../../store/use-mobile-menu.ts";
import Content from "../../../content.ts";

export const DocumentsList: React.FC = () => {
	const { isFolderFirstLoad, getItemsInCurrentFolder } = useFolderStore();
	const { isDocumentFirstLoad, isLoading } = useDocumentStore();
	const { isMobileCheckboxVisible } = useMobileMenuStore();

	const isFirstLoad = isDocumentFirstLoad || isFolderFirstLoad;

	const itemsInCurrentFolder = getItemsInCurrentFolder();

	const sortedItems = getSortedItems(itemsInCurrentFolder);

	return (
		<div className="flex flex-col w-full h-full md:mt-3">
			<div className="flex flex-row justify-between items-center gap-3 px-2 md:pr-2 md:pl-0 py-1.5 border-b-[1px] border-b-dunkelblau-60">
				<MultiSelectForAction />

				<div
					className={`md:flex items-center gap-2 ${isMobileCheckboxVisible ? "hidden" : "flex"}`}
				>
					{Content["documentsList.AddToChat"]}{" "}
					<AddToChatIcon variant={"plus-light"} />
				</div>
			</div>

			<div className="flex flex-col w-full h-full">
				<ul
					className="grow h-0 overflow-y-auto mt-2 md:mt-0 pl-2 md:pl-0"
					style={{ scrollbarGutter: "stable" }}
				>
					{(isFirstLoad || isLoading) && <DocumentListSkeleton count={8} />}

					{!isFirstLoad &&
						!isLoading &&
						sortedItems.map((item) => (
							<ListItem key={getUniqueId(item)} item={item} />
						))}
				</ul>
			</div>
		</div>
	);
};
