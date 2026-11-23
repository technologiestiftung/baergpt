import { describe, it, expect } from "vitest";
import * as XLSX from "@e965/xlsx";
import { parseTable } from "./parse-table.ts";
import { buildWorkbook, tableToCsv, toCsvField } from "./export-table.ts";

describe("xlsx export", () => {
	it("keeps headers and writes numbers as numeric cells", () => {
		const table = parseTable([
			["Bezirk", "Einwohner", "Anteil", "Kennung"],
			["Berlin", "3.755.251", "10,8 %", "00123"],
		]);
		const written = XLSX.write(buildWorkbook(XLSX, table), {
			type: "buffer",
			bookType: "xlsx",
		});
		const sheet = XLSX.read(written, { cellNF: true }).Sheets["Tabelle 1"];

		expect(sheet.A1).toMatchObject({ t: "s", v: "Bezirk" });
		expect(sheet.B2).toMatchObject({ t: "n", v: 3755251, z: "#,##0" });
		expect(sheet.C2).toMatchObject({ t: "n", z: "0.0%" });
		expect(sheet.C2.v).toBeCloseTo(0.108);
		expect(sheet.D2).toMatchObject({ t: "s", v: "00123" });
	});

	it("keeps the source decimals for euro amounts", () => {
		const table = parseTable([["Preis"], ["0,125 €"], ["1.234 €"]]);
		const sheet = buildWorkbook(XLSX, table).Sheets["Tabelle 1"];

		expect(sheet.A2).toMatchObject({ v: 0.125, z: '#,##0.000 "€"' });
		expect(sheet.A3).toMatchObject({ v: 1234, z: '#,##0 "€"' });
	});

	it("keeps the source decimals for plain numbers", () => {
		const table = parseTable([["Wert"], ["3,50"]]);
		const sheet = buildWorkbook(XLSX, table).Sheets["Tabelle 1"];

		expect(sheet.A2).toMatchObject({ v: 3.5, z: "0.00" });
	});
});

describe("csv export", () => {
	it("writes German numbers with a semicolon separator and BOM", () => {
		const csv = tableToCsv(
			parseTable([
				["Bezirk", "Anteil", "Budget"],
				["Mitte; Zentrum", "10,8 %", "1.234,50 €"],
			]),
		);

		expect(csv).toBe(
			'\uFEFFBezirk;Anteil;Budget\r\n"Mitte; Zentrum";10,8 %;1234,50 €',
		);
	});

	it("never writes numbers in exponent notation", () => {
		expect(
			toCsvField({ kind: "number", value: 1e-7, decimals: 7, grouped: false }),
		).toBe("0,0000001");
		expect(
			toCsvField({ kind: "number", value: -5, decimals: 0, grouped: false }),
		).toBe("-5");
	});

	it.each([
		["=HYPERLINK(1)", "'=HYPERLINK(1)"],
		["@SUM(A1)", "'@SUM(A1)"],
		["+HYPERLINK(1)", "'+HYPERLINK(1)"],
		["-2+3+cmd|' /C calc'!A0", "'-2+3+cmd|' /C calc'!A0"],
		["+2+3", "'+2+3"],
		["-2-3", "'-2-3"],
		["+49-30-123456", "'+49-30-123456"],
	])("neutralises formula %s", (text, expected) => {
		expect(toCsvField({ kind: "text", value: text })).toBe(expected);
	});

	it.each(["-", "+49 30 123456", "-5 Tage", "00123", "1234567890123456"])(
		"leaves %s unescaped",
		(text) => {
			expect(toCsvField({ kind: "text", value: text })).toBe(text);
		},
	);
});
