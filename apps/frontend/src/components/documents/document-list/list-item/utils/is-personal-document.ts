import type { UserDocument } from "../../../../../common.ts";
import type { ListItem } from "./types.ts";
import { isDocument } from "./is-document.ts";

export const isPersonalDocument = (
	item: ListItem | null,
): item is UserDocument =>
	!!item && isDocument(item) && item.source_type === "personal_document";
