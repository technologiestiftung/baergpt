import type { Column } from "react-data-grid";
import type { GridRow } from "./types.ts";

export const ROW_NUMBER_KEY = "__rownum__";

/** Caps mirroring the backend extraction limits (ExcelExtractionService). */
export const MAX_ROWS = 2000;
export const MAX_COLS = 64;

const ROW_NUMBER_COLUMN_WIDTH = 56;

/** Frozen row-number column shown to the left of the data columns. */
export const ROW_NUMBER_COLUMN: Column<GridRow> = {
	key: ROW_NUMBER_KEY,
	name: "",
	width: ROW_NUMBER_COLUMN_WIDTH,
	frozen: true,
	resizable: false,
	cellClass: "rdg-row-number",
};
