import type { PublicDocument } from "../../../../../common.ts";
import type { ListItem } from "./types.ts";
import { isDocument } from "./is-document.ts";

export const isPublicDocument = (item: ListItem): item is PublicDocument =>
	isDocument(item) && item.source_type === "public_document";
