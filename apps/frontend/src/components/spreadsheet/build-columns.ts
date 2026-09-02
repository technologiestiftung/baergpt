import * as XLSX from "@e965/xlsx";
import type { CellValue, GridRow } from "./types.ts";
import type { Column } from "react-data-grid";
import { ROW_NUMBER_COLUMN } from "./constants.ts";

export function buildColumns(
	columnCount: number,
	colOffset: number,
): Column<GridRow>[] {
	const dataColumns = Array.from({ length: columnCount }, (_, colIndex) =>
		buildDataColumn(colIndex, colOffset),
	);
	return [ROW_NUMBER_COLUMN, ...dataColumns];
}

function buildDataColumn(colIndex: number, colOffset: number): Column<GridRow> {
	return {
		key: `c${colIndex}`,
		// `encode_col` is 0-based (0 -> "A", 26 -> "AA"); `colOffset` shifts it to
		// the sheet's actual column when the used range doesn't start at "A".
		name: XLSX.utils.encode_col(colIndex + colOffset),
		resizable: true,
		renderCell: ({ row, column }) => formatDisplay(row[column.key]),
	};
}

function formatDisplay(value: CellValue | number): string {
	if (value === null || value === undefined) {
		return "";
	}
	if (typeof value === "boolean") {
		return value ? "TRUE" : "FALSE";
	}
	return String(value);
}
