export type CellValue = string | number | boolean | null;

export type Sheet = {
	name: string;
	rows: CellValue[][];
};

export type GridRow = Record<string, CellValue | number> & { __id__: number };
