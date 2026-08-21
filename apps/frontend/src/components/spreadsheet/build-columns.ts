import * as XLSX from "@e965/xlsx";
import type { CellValue, GridRow } from "./types.ts";
import type { Column } from "react-data-grid";
import { ROW_NUMBER_COLUMN } from "./constants.ts";

export function buildColumns(columnCount: number): Column<GridRow>[] {
	const dataColumns = Array.from({ length: columnCount }, (_, colIndex) =>
		buildDataColumn(colIndex),
	);
	return [ROW_NUMBER_COLUMN, ...dataColumns];
}

function buildDataColumn(colIndex: number): Column<GridRow> {
	return {
		key: `c${colIndex}`,
		// `encode_col` is 0-based (0 -> "A", 26 -> "AA"), matching `colIndex` directly.
		name: XLSX.utils.encode_col(colIndex),
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
