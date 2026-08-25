export type CellValue = string | number | boolean | null;

export type Sheet = {
	name: string;
	rows: CellValue[][];
	/** 0-based row/column of the sheet's used range that `rows` starts at. */
	rowOffset: number;
	colOffset: number;
};

export type GridRow = Record<string, CellValue | number> & { __id__: number };
