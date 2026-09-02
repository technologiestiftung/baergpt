import type { CellValue } from "./types.ts";

export function getColumnCount(rows: CellValue[][]): number {
	return rows.reduce((max, row) => Math.max(max, row.length), 0);
}
