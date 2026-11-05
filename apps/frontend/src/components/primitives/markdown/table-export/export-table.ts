import type { CellObject, WorkBook } from "@e965/xlsx";
import type { NumberUnit, ParsedCell, ParsedTable } from "./parse-table.ts";
import { downloadBlob } from "../../../../lib/download-blob.ts";
import Content from "../../../../content.ts";

export type TableExportFormat = "xlsx" | "csv";

// German Excel only splits on ";" and needs the BOM to read UTF-8 umlauts
const CSV_SEPARATOR = ";";
const UTF8_BOM = "\uFEFF";

type NumberCell = Extract<ParsedCell, { kind: "number" }>;

function excelNumberFormat(cell: NumberCell) {
	const decimals = cell.decimals > 0 ? `.${"0".repeat(cell.decimals)}` : "";
	if (cell.unit === "percent") {
		return `0${decimals}%`;
	}
	if (cell.unit === "euro") {
		return `#,##0${decimals} "€"`;
	}
	if (cell.grouped) {
		return `#,##0${decimals}`;
	}
	return decimals ? `0${decimals}` : undefined;
}

function toXlsxCell(cell: ParsedCell): CellObject {
	if (cell.kind === "text") {
		return { t: "s", v: cell.value };
	}
	return {
		t: "n",
		v: cell.unit === "percent" ? cell.value / 100 : cell.value,
		z: excelNumberFormat(cell),
	};
}

const UNIT_SUFFIX: Record<NumberUnit, string> = {
	percent: " %",
	euro: " €",
};

function formatCsvNumber(cell: NumberCell): string {
	const number = cell.value.toLocaleString("de-DE", {
		useGrouping: false,
		minimumFractionDigits: cell.decimals,
		maximumFractionDigits: cell.decimals,
	});
	return `${number}${cell.unit ? UNIT_SUFFIX[cell.unit] : ""}`;
}

// Text may come from web pages or documents. Excel shows the escaping "'", so
// "+"/"-" are only escaped when an operator follows that Excel would evaluate
function isFormulaLike(text: string): boolean {
	return /^[=@\t\r]/.test(text) || /^[+-].*[-+*/^&(|!=]/.test(text);
}

export function toCsvField(cell: ParsedCell): string {
	let text: string;
	if (cell.kind === "number") {
		text = formatCsvNumber(cell);
	} else {
		text = isFormulaLike(cell.value) ? `'${cell.value}` : cell.value;
	}
	return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function tableToCsv({ header, rows }: ParsedTable): string {
	const headerCells: ParsedCell[] = header.map((value) => ({
		kind: "text",
		value,
	}));
	return (
		UTF8_BOM +
		[headerCells, ...rows]
			.map((row) => row.map(toCsvField).join(CSV_SEPARATOR))
			.join("\r\n")
	);
}

export async function exportTable(
	table: ParsedTable,
	format: TableExportFormat,
	fileName: string,
) {
	if (format === "csv") {
		downloadBlob(
			new Blob([tableToCsv(table)], { type: "text/csv;charset=utf-8" }),
			`${fileName}.csv`,
		);
		return;
	}

	const XLSX = await import("@e965/xlsx");
	XLSX.writeFile(buildWorkbook(XLSX, table), `${fileName}.xlsx`);
}

export function buildWorkbook(
	XLSX: typeof import("@e965/xlsx"),
	table: ParsedTable,
): WorkBook {
	const worksheet = XLSX.utils.aoa_to_sheet([
		table.header,
		...table.rows.map((row) => row.map(toXlsxCell)),
	]);
	const workbook = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(
		workbook,
		worksheet,
		Content["chat.exportTableButton.sheetName"],
	);
	return workbook;
}
