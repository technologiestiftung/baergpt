import * as XLSX from "@e965/xlsx";
import { type CellValue, type Sheet } from "./types.ts";
import { MAX_COLS, MAX_ROWS } from "./constants.ts";

/**
 * Parse an xlsx/csv blob into sheets of 2D cell arrays using SheetJS.
 * Read-only, values only — formulas are read as their last computed value.
 */
export async function parseWorkbook(
	blob: Blob,
): Promise<{ sheets: Sheet[]; truncated: boolean }> {
	const buffer = await blob.arrayBuffer();
	// Read one row past the cap so truncation can be detected from the actual
	// parsed data below (`!fullref`/`!ref` metadata isn't reliable across
	// formats — e.g. SheetJS's CSV parser never sets `!fullref`).
	const workbook = XLSX.read(buffer, {
		type: "array",
		sheetRows: MAX_ROWS + 1,
	});
	let truncated = false;

	const sheets: Sheet[] = workbook.SheetNames.map((name) => {
		const worksheet = workbook.Sheets[name];
		const fullRange = worksheet["!ref"]
			? XLSX.utils.decode_range(worksheet["!ref"])
			: null;

		// Widen the requested range by one row/column past the cap so a
		// truncated dimension shows up as extra length in `raw` below.
		const cappedRange = fullRange
			? {
					s: fullRange.s,
					e: {
						r: Math.min(fullRange.e.r, fullRange.s.r + MAX_ROWS),
						c: Math.min(fullRange.e.c, fullRange.s.c + MAX_COLS),
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

		if (raw.length > MAX_ROWS || raw.some((row) => row.length > MAX_COLS)) {
			truncated = true;
		}

		const rows = raw.slice(0, MAX_ROWS).map((row) => {
			const capped = row.slice(0, MAX_COLS);
			return capped.map((cell) => (cell === undefined ? null : cell));
		});

		return {
			name,
			rows,
			rowOffset: fullRange?.s.r ?? 0,
			colOffset: fullRange?.s.c ?? 0,
		};
	});

	return { sheets, truncated };
}
