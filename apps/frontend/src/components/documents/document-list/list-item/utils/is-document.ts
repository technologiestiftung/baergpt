import { Document } from "../../../../../common.ts";
import { ListItem } from "./types.ts";

export const isDocument = (item: ListItem): item is Document =>
	!!item && "file_name" in item;
