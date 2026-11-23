import type { ListItem } from "./types.ts";
import { isDocument } from "./is-document.ts";
import { getListItemName } from "./get-list-item-name.ts";

const naturalCollator = new Intl.Collator("de", {
	numeric: true,
	sensitivity: "base",
});

// Keeps the order stable for names the natural collator treats as equal
// ("Bericht" / "bericht", "Anlage-1" / "Anlage-01")
const tiebreakCollator = new Intl.Collator("de", { sensitivity: "variant" });

/**
 * Returns a sorted copy of a list of ListItem objects (Document or Folder).
 *
 * - Folders are always listed before documents.
 * - Items are sorted naturally (alphabetical, case-insensitive, numbers by value)
 *   by their displayed name (see `getListItemName`).
 *
 * @param items Array of ListItem (Document | Folder)
 * @returns New array with folders first, then documents, both naturally sorted
 */
export function getSortedItems<T extends ListItem>(items: T[]): T[] {
	return [...items].sort((a, b) => {
		if (!isDocument(a) && isDocument(b)) {
			return -1;
		}
		if (isDocument(a) && !isDocument(b)) {
			return 1;
		}
		const nameA = getListItemName(a);
		const nameB = getListItemName(b);
		return (
			naturalCollator.compare(nameA, nameB) ||
			tiebreakCollator.compare(nameA, nameB) ||
			a.id - b.id
		);
	});
}
