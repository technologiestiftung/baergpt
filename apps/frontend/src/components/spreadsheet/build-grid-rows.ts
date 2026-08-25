import type { CellValue, GridRow } from "./types.ts";
import { ROW_NUMBER_KEY } from "./constants.ts";

export function buildGridRows(
	rows: CellValue[][],
	columnCount: number,
	rowOffset: number,
): GridRow[] {
	return rows.map((cells, rowIndex) =>
		buildGridRow(cells, rowIndex, { columnCount, rowOffset }),
	);
}

function buildGridRow(
	cells: CellValue[],
	rowIndex: number,
	{ columnCount, rowOffset }: { columnCount: number; rowOffset: number },
): GridRow {
	const row: GridRow = {
		__id__: rowIndex,
		[ROW_NUMBER_KEY]: rowIndex + rowOffset + 1,
	};
	for (let colIndex = 0; colIndex < columnCount; colIndex++) {
		row[`c${colIndex}`] = cells[colIndex] ?? null;
	}
	return row;
}
