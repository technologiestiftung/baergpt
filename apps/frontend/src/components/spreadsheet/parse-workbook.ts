import * as XLSX from "@e965/xlsx";
import { type CellValue, type Sheet } from "./types.ts";
import { MAX_COLS, MAX_ROWS } from "./constants.ts";

/**
 * Parse an xlsx/csv blob into sheets of 2D cell arrays using SheetJS.
 * Read-only, values only — formulas are read as their last computed value.
 *
 * `!fullref` is set by SheetJS when `sheetRows` cuts a sheet's read short; it
 * holds the sheet's true original range while `!ref` narrows to what was
 * actually read. It's real at runtime but missing from `@e965/xlsx`'s types.
 */
type WorksheetWithFullRef = XLSX.WorkSheet & { "!fullref"?: string };

export async function parseWorkbook(
	blob: Blob,
): Promise<{ sheets: Sheet[]; truncated: boolean }> {
	const buffer = await blob.arrayBuffer();
	// Bound how many rows SheetJS actually reads per sheet, so a huge sheet
	// isn't fully parsed into memory before we cap it below.
	const workbook = XLSX.read(buffer, { type: "array", sheetRows: MAX_ROWS });
	let truncated = false;

	const sheets: Sheet[] = workbook.SheetNames.map((name) => {
		const worksheet = workbook.Sheets[name] as WorksheetWithFullRef;
		const ref = worksheet["!fullref"] ?? worksheet["!ref"];
		const fullRange = ref ? XLSX.utils.decode_range(ref) : null;

		if (fullRange) {
			const rowCount = fullRange.e.r - fullRange.s.r + 1;
			const colCount = fullRange.e.c - fullRange.s.c + 1;
			if (rowCount > MAX_ROWS || colCount > MAX_COLS) {
				truncated = true;
			}
		}

		const cappedRange = fullRange
			? {
					s: fullRange.s,
					e: {
						r: Math.min(fullRange.e.r, fullRange.s.r + MAX_ROWS - 1),
						c: Math.min(fullRange.e.c, fullRange.s.c + MAX_COLS - 1),
					},
				}
			: undefined;

		// `blankrows: true` keeps fully-blank rows in place (as null-filled rows)
		// instead of dropping them, so the displayed row number still matches the
		// row's actual position in the source sheet.
		const raw = XLSX.utils.sheet_to_json<CellValue[]>(worksheet, {
			header: 1,
			blankrows: true,
			defval: null,
			raw: true,
			range: cappedRange,
		});

		// Defensive slice: `range` above should already bound `raw` to
		// MAX_ROWS x MAX_COLS, but we keep the cap here too as a safety net.
		const rows = raw.slice(0, MAX_ROWS).map((row) => {
			const capped = row.slice(0, MAX_COLS);
			return capped.map((cell) => (cell === undefined ? null : cell));
		});

		return { name, rows };
	});

	return { sheets, truncated };
}
