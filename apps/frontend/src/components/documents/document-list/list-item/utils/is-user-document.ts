import type { Document } from "../../../../../common.ts";
import type { ListItem } from "./types.ts";
import { isDocument } from "./is-document.ts";

export const isUserDocument = (item: ListItem): item is Document =>
	isDocument(item) && item.source_type === "personal_document";
