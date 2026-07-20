import type { PublicFolder } from "../../../../../common.ts";
import type { ListItem } from "./types.ts";
import { isDocument } from "./is-document.ts";
import { isUserFolder } from "./is-user-folder.ts";

export const isPublicFolder = (item: ListItem | null): item is PublicFolder =>
	item !== null && !isDocument(item) && !isUserFolder(item);
