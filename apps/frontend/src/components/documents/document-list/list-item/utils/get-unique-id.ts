import type { ListItem } from "./types.ts";
import { isDocument } from "./is-document.ts";

export function getUniqueId(item: ListItem) {
	return isDocument(item) ? `${item.id}_document` : `${item.id}_folder`;
}
