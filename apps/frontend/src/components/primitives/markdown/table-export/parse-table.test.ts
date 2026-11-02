import { describe, it, expect } from "vitest";
import { parseCell, parseTable } from "./parse-table.ts";

describe("parseCell", () => {
	it.each([
		["397.134", 397134],
		["1.234,56", 1234.56],
		["10,8", 10.8],
		["-42", -42],
		["−3,5", -3.5],
		["0,5", 0.5],
		["+3", 3],
	])("parses German number %s", (text, expected) => {
		expect(parseCell(text, "de")).toMatchObject({
			kind: "number",
			value: expected,
		});
	});

	it.each([
		["1,234.5", 1234.5],
		["3.5", 3.5],
	])("parses English number %s", (text, expected) => {
		expect(parseCell(text, "en")).toMatchObject({
			kind: "number",
			value: expected,
		});
	});

	it("keeps units as number formats", () => {
		expect(parseCell("10,8 %", "de")).toMatchObject({
			value: 10.8,
			unit: "percent",
			decimals: 1,
		});
		expect(parseCell("1.234,50 €", "de")).toMatchObject({
			value: 1234.5,
			unit: "euro",
			grouped: true,
		});
		expect(parseCell("€ 980", "de")).toMatchObject({
			value: 980,
			unit: "euro",
		});
	});

	it.each([
		"00123",
		"01067",
		"12.03.2024",
		"k. A.",
		"-",
		"",
		"DE89370400440532013000",
		"1234567890123456",
		"+49 30 123456",
	])("keeps %s as text", (text) => {
		expect(parseCell(text, "de")).toEqual({ kind: "text", value: text });
	});
});

describe("parseTable", () => {
	it("detects the number locale per column", () => {
		const table = parseTable([
			["Bezirk", "Einwohner", "Fläche"],
			["Mitte", "397.134", "39.47"],
			["Pankow", "410.716", "103.2"],
		]);

		expect(table.rows[0][1]).toMatchObject({ value: 397134 });
		expect(table.rows[0][2]).toMatchObject({ value: 39.47 });
	});

	it("names empty headers and pads ragged rows", () => {
		const table = parseTable([["Name", ""], ["Mitte"]]);

		expect(table.header).toEqual(["Name", "Spalte 2"]);
		expect(table.rows[0][1]).toEqual({ kind: "text", value: "" });
	});
});
