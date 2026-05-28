import type { UserDocument } from "../../../../../common.ts";
import type { ListItem } from "./types.ts";
import { isDocument } from "./is-document.ts";

export const isUserDocument = (item: ListItem): item is UserDocument =>
	isDocument(item) &&
	(item.source_type === "personal_document" ||
		item.source_type === "default_document");
