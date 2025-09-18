import { ListItem } from "./types.ts";
import { isDocument } from "./is-document.ts";

/**
 * Sorts a list of ListItem objects (Document or DocumentFolder).
 *
 * - Folders are always listed before documents.
 * - Items are sorted alphabetically (case-insensitive) by:
 *   - `name` for folders
 *   - `file_name` for documents (falls back to empty string if missing)
 *
 * @param items Array of ListItem (Document | DocumentFolder)
 * @returns Sorted array with folders first, then documents, both alphabetically
 */
export function getSortedItems(items: ListItem[]) {
	return items.sort((a, b) => {
		if (!isDocument(a) && isDocument(b)) {
			return -1;
		}
		if (isDocument(a) && !isDocument(b)) {
			return 1;
		}
		// sort: alphabetical, case-insensitive
		const nameA = isDocument(a)
			? (a.file_name ?? "").toLowerCase()
			: a.name.toLowerCase();
		const nameB = isDocument(b)
			? (b.file_name ?? "").toLowerCase()
			: b.name.toLowerCase();
		if (nameA < nameB) {
			return -1;
		}
		if (nameA > nameB) {
			return 1;
		}
		return 0;
	});
}
