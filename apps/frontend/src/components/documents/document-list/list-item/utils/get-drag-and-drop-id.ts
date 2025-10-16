import type { ListItem } from "./types.ts";
import { getUniqueId } from "./get-unique-id.ts";

export const getDragAndDropId = (item: ListItem | null): string => {
	if (!item) {
		return "back-folder";
	}
	return getUniqueId(item);
};
