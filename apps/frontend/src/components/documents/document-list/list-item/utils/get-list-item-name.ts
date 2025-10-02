import type { ListItem } from "./types.ts";
import { isDocument } from "./is-document.ts";

/**
 * Gets the name of the list item based on its type.
 */
export const getListItemName = (listItem: ListItem) => {
	if (!listItem) {
		return "";
	}

	const isFolder = !isDocument(listItem);

	if (isFolder) {
		return listItem.name;
	}
	if (listItem.file_name) {
		return listItem.file_name;
	}

	return listItem.source_url;
};
