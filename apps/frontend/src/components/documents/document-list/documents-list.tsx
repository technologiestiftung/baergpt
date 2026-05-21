import React from "react";
import { ListItem } from "./list-item/list-item";
import { useUserFolderStore } from "../../../store/use-user-folder-store.ts";
import { useUserDocumentStore } from "../../../store/use-user-document-store.ts";
import DocumentListSkeleton from "../../primitives/skeletons/document-list-skeleton";
import { getSortedItems } from "./list-item/utils/get-sorted-items.ts";
import { getUniqueId } from "./list-item/utils/get-unique-id.ts";
import { isDocument } from "./list-item/utils/is-document.ts";
import { DocumentListHeader } from "./document-list-header.tsx";
import { usePublicDocumentsStore } from "../../../store/use-public-documents-store.ts";
import { useCurrentFolderStore } from "../../../store/use-current-folder-store.ts";
import { isPublicFolder } from "./list-item/utils/is-public-folder.ts";

export const DocumentsList: React.FC = () => {
	const { currentFolder } = useCurrentFolderStore();
	const { publicDocuments } = usePublicDocumentsStore();
	const { isUserFolderFirstLoad, getUserItemsInCurrentFolder } =
		useUserFolderStore();
	const { isDocumentFirstLoad, isLoading, deletedDefaultDocumentIds } =
		useUserDocumentStore();

	const isFirstLoad = isDocumentFirstLoad || isUserFolderFirstLoad;

	const userItemsInCurrentFolder = getUserItemsInCurrentFolder();

	const sortedItems = getSortedItems(userItemsInCurrentFolder);

	// Filter out deleted default documents by ID
	const filteredItems = sortedItems.filter(
		(item) => !isDocument(item) || !deletedDefaultDocumentIds.includes(item.id),
	);

	const height = currentFolder || filteredItems.length > 0 ? "h-full" : "h-fit";

	return (
		<div className={`flex flex-col w-full ${height}`}>
			<DocumentListHeader />

			<div className="flex flex-col w-full h-full">
				<ul className="grow h-0 overflow-y-auto mt-2 md:mt-0 filesection-scrollbar">
					{(isFirstLoad || isLoading) && <DocumentListSkeleton count={8} />}

					{isPublicFolder(currentFolder) &&
						publicDocuments.map((item) => (
							<ListItem key={getUniqueId(item)} item={item} />
						))}

					{!isFirstLoad &&
						!isLoading &&
						!isPublicFolder(currentFolder) &&
						filteredItems.map((item) => (
							<ListItem key={getUniqueId(item)} item={item} />
						))}
				</ul>
			</div>
		</div>
	);
};
