import Content from "../../../../content.ts";

export type NumberUnit = "percent" | "euro";

export type ParsedCell =
	| { kind: "text"; value: string }
	| {
			kind: "number";
			value: number;
			decimals: number;
			grouped: boolean;
			unit?: NumberUnit;
	  };

export interface ParsedTable {
	header: string[];
	rows: ParsedCell[][];
}

type NumberLocale = "de" | "en";

// A leading 0 is never a thousands group, so "0.125" can only be a decimal
const DE_NUMBER = /^[1-9]\d{0,2}(\.\d{3})+(,\d+)?$|^\d+(,\d+)?$/;
const EN_NUMBER = /^[1-9]\d{0,2}(,\d{3})+(\.\d+)?$|^\d+(\.\d+)?$/;

// Beyond this Excel silently rounds, which would corrupt IDs like IBANs
const MAX_SIGNIFICANT_DIGITS = 15;
// toLocaleString throws beyond this in older engines
const MAX_DECIMALS = 20;

function splitUnit(text: string): { core: string; unit?: NumberUnit } {
	const suffix = text.match(/^(.*?)\s*(%|€|EUR)$/);
	if (suffix) {
		return {
			core: suffix[1],
			unit: suffix[2] === "%" ? "percent" : "euro",
		};
	}
	const prefix = text.match(/^([-−+]?)\s*€\s*(.*)$/);
	if (prefix) {
		return { core: `${prefix[1]}${prefix[2]}`, unit: "euro" };
	}
	return { core: text };
}

function splitSign(core: string): { negative: boolean; digits: string } {
	const match = core.match(/^([-−+])\s*(.*)$/);
	return match
		? { negative: match[1] !== "+", digits: match[2] }
		: { negative: false, digits: core };
}

// "1.234" means different numbers in German and English, so only
// unambiguous cells decide the column's locale
function detectColumnLocale(cells: string[]): NumberLocale | undefined {
	let germanVotes = 0;
	let englishVotes = 0;
	for (const cell of cells) {
		const { digits } = splitSign(splitUnit(cell.trim()).core);
		const isGerman = DE_NUMBER.test(digits);
		const isEnglish = EN_NUMBER.test(digits);
		if (isGerman && !isEnglish) {
			germanVotes++;
		} else if (isEnglish && !isGerman) {
			englishVotes++;
		}
	}
	if (germanVotes === englishVotes) {
		return undefined;
	}
	return englishVotes > germanVotes ? "en" : "de";
}

export function parseCell(
	text: string,
	locale: NumberLocale | undefined,
): ParsedCell {
	const trimmed = text.trim();
	const { core, unit } = splitUnit(trimmed);
	const { negative, digits } = splitSign(core);

	// Guessing could silently turn 52.520 into 52520, so keep the original text
	if (!locale && /[.,]/.test(digits)) {
		return { kind: "text", value: trimmed };
	}

	const resolvedLocale = locale ?? "de";
	const pattern = resolvedLocale === "de" ? DE_NUMBER : EN_NUMBER;
	const isLeadingZeroId = /^0\d/.test(digits);
	const significantDigits = digits.replace(/\D/g, "").replace(/^0+/, "");

	if (
		!pattern.test(digits) ||
		isLeadingZeroId ||
		significantDigits.length > MAX_SIGNIFICANT_DIGITS
	) {
		return { kind: "text", value: trimmed };
	}

	const [groupSeparator, decimalSeparator] =
		resolvedLocale === "de" ? [".", ","] : [",", "."];
	const [integerPart, fractionPart = ""] = digits.split(decimalSeparator);
	if (fractionPart.length > MAX_DECIMALS) {
		return { kind: "text", value: trimmed };
	}
	const magnitude = Number(
		`${integerPart.split(groupSeparator).join("")}.${fractionPart || "0"}`,
	);

	return {
		kind: "number",
		value: negative ? -magnitude : magnitude,
		decimals: fractionPart.length,
		grouped: integerPart.includes(groupSeparator),
		unit,
	};
}

export function parseTable(rawRows: string[][]): ParsedTable {
	const [rawHeader = [], ...rawBody] = rawRows;
	const width = Math.max(rawHeader.length, ...rawBody.map((row) => row.length));

	const header = Array.from(
		{ length: width },
		(_, index) =>
			rawHeader[index]?.trim() ||
			`${Content["chat.exportTableButton.emptyHeaderPrefix"]} ${index + 1}`,
	);
	const body = rawBody.map((row) =>
		Array.from({ length: width }, (_, index) => row[index] ?? ""),
	);

	const columnLocales = header.map((_, index) =>
		detectColumnLocale(body.map((row) => row[index])),
	);

	return {
		header,
		rows: body.map((row) =>
			row.map((cell, index) => parseCell(cell, columnLocales[index])),
		),
	};
}
