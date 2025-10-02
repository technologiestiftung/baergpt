import type { Document } from "../../../../../common.ts";
import type { ListItem } from "./types.ts";

export const isDocument = (item: ListItem): item is Document =>
	!!item && "file_name" in item;
