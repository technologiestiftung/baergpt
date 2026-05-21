import type { UserFolder } from "../../../../../common.ts";
import type { ListItem } from "./types.ts";

export const isUserFolder = (item: ListItem | null): item is UserFolder =>
	!!item && "user_id" in item;
