import { countMistralTokens } from "./token-utils";

/** Soft target for DOCX, MD, XLSX, CSV */
export const CHUNK_TARGET_TOKENS = 1000;

export type PageChunk = {
	/** Exact slice of the page */
	content: string;
	/** Optional table-header prefix + trimmed content */
	embeddingInput: string;
	tokenCount: number;
	usedCharacterFallback: boolean;
};

type Piece = {
	start: number;
	end: number;
	tokens: number;
	usedCharacterFallback: boolean;
};

type TableBlock = {
	/** Header row + separator row */
	header: string;
	headerLine: string;
	separatorStart: number;
	bodyStart: number;
	end: number;
};

type Prefix = { text: string; tokens: number };

const NO_PREFIX: Prefix = { text: "", tokens: 0 };

// Coarse to fine; separators stay with the preceding piece.
// Cheap assertion first, to avoid quadratic scans over long whitespace runs.
const BOUNDARIES: RegExp[] = [
	// blank line, or before a heading
	/(?<=\n)(?=[^\S\n]*\S)(?<=\n[^\S\n]*\n)|(?<=\n)(?=#{1,6}[ \t])/,
	// line
	/(?<=\n)/,
	// sentence
	/(?=\S)(?<=[.!?]\s+)/,
	// word
	/(?=\S)(?<=\s)/,
];

const BOS_EOS_TOKENS = 2;
const TABLE_LINE = /^[^\S\n]*\|/;
const TABLE_SEPARATOR_CHARACTERS = /^[^\S\n]*\|[\s|:-]*$/;

// Two checks: a single regex backtracks quadratically on long dash runs
function isTableSeparatorLine(line: string): boolean {
	return line.includes("---") && TABLE_SEPARATOR_CHARACTERS.test(line);
}

export function buildEmbeddingInput(content: string, prefix: string): string {
	return `${prefix}${content.trim()}`;
}

/** Chunks of about `targetTokens`, never over `maxTokens`; never crosses the page */
export function chunkPage(
	pageContent: string,
	{ targetTokens, maxTokens }: { targetTokens: number; maxTokens: number },
): PageChunk[] {
	if (!pageContent.trim()) {
		return [];
	}
	const target = Math.min(targetTokens, maxTokens);
	const tables = findTables(pageContent);
	const prefixes = new Map<string, Prefix>();

	const getPrefix = (offset: number): Prefix => {
		const table = tables.find(
			({ separatorStart, end }) => offset >= separatorStart && offset < end,
		);
		if (!table) {
			return NO_PREFIX;
		}
		// Starting at the separator row: only the header line is missing
		const text = offset < table.bodyStart ? table.headerLine : table.header;
		if (!prefixes.has(text)) {
			const tokens = estimateTokens(text);
			// Skip headers wider than half the target
			prefixes.set(text, tokens <= target / 2 ? { text, tokens } : NO_PREFIX);
		}
		return prefixes.get(text) ?? NO_PREFIX;
	};

	const pieces = splitIntoPieces(pageContent, 0, 0, target);
	const groups = fillGroups(pageContent, pieces, target, getPrefix);

	return groups.flatMap((group) =>
		buildChunks(pageContent, group, maxTokens, getPrefix),
	);
}

/** Count without BOS/EOS, +1 margin: a piece alone may need one token fewer than in context */
function estimateTokens(text: string): number {
	return Math.max(0, countMistralTokens(text) - BOS_EOS_TOKENS + 1);
}

function isWhitespace(text: string): boolean {
	return text.trim() === "";
}

/** Contiguous pieces that each fit the target, split at the coarsest working boundary */
function splitIntoPieces(
	text: string,
	offset: number,
	level: number,
	target: number,
	knownTokens?: number,
): Piece[] {
	const tokens = knownTokens ?? estimateTokens(text);
	// tokens + 1 = real count
	if (tokens + BOS_EOS_TOKENS - 1 <= target || isWhitespace(text)) {
		return [
			{
				start: offset,
				end: offset + text.length,
				tokens,
				usedCharacterFallback: false,
			},
		];
	}
	if (level >= BOUNDARIES.length) {
		return splitByCharacters(text, offset, tokens, target);
	}

	const parts = text.split(BOUNDARIES[level]);
	if (parts.length === 1) {
		return splitIntoPieces(text, offset, level + 1, target, tokens);
	}

	const pieces: Piece[] = [];
	let partOffset = offset;
	for (const part of parts) {
		pieces.push(...splitIntoPieces(part, partOffset, level + 1, target));
		partOffset += part.length;
	}
	return pieces;
}

/** Last resort for text without whitespace; keeps surrogate pairs intact */
function splitByCharacters(
	text: string,
	offset: number,
	tokens: number,
	target: number,
): Piece[] {
	const characters = Array.from(text);
	const charactersPerPiece = Math.max(
		1,
		Math.floor((characters.length * target) / (tokens * 2)),
	);
	const pieces: Piece[] = [];
	let pieceOffset = offset;
	for (let index = 0; index < characters.length; index += charactersPerPiece) {
		const pieceText = characters
			.slice(index, index + charactersPerPiece)
			.join("");
		const pieceTokens = estimateTokens(pieceText);
		// Only recurse on smaller text, so it always terminates
		if (
			pieceTokens + BOS_EOS_TOKENS - 1 > target &&
			charactersPerPiece < characters.length
		) {
			pieces.push(
				...splitByCharacters(pieceText, pieceOffset, pieceTokens, target),
			);
		} else {
			pieces.push({
				start: pieceOffset,
				end: pieceOffset + pieceText.length,
				tokens: pieceTokens,
				usedCharacterFallback: true,
			});
		}
		pieceOffset += pieceText.length;
	}
	return pieces;
}

/** Fills groups up to the target; whitespace pieces join the current group */
function fillGroups(
	text: string,
	pieces: Piece[],
	target: number,
	getPrefix: (offset: number) => Prefix,
): Piece[][] {
	const groups: Piece[][] = [];
	let current: Piece[] = [];
	let currentTokens = 0;
	let currentHasText = false;

	for (const piece of pieces) {
		const pieceHasText = !isWhitespace(text.slice(piece.start, piece.end));
		if (
			currentHasText &&
			pieceHasText &&
			currentTokens + piece.tokens > target
		) {
			groups.push(current);
			current = [];
			currentTokens = 0;
			currentHasText = false;
		}
		if (pieceHasText && !currentHasText) {
			currentTokens += BOS_EOS_TOKENS + getPrefix(piece.start).tokens;
			currentHasText = true;
		}
		current.push(piece);
		currentTokens += piece.tokens;
	}

	// Trailing whitespace belongs to the previous chunk
	const lastGroup = groups.at(-1);
	if (!currentHasText && lastGroup) {
		lastGroup.push(...current);
	} else if (current.length > 0) {
		groups.push(current);
	}
	return groups;
}

/** Checks the real count; over the limit: split in half, then drop the prefix. Never cuts. */
function buildChunks(
	text: string,
	group: Piece[],
	maxTokens: number,
	getPrefix: (offset: number) => Prefix,
	withPrefix: boolean = true,
): PageChunk[] {
	const start = group[0].start;
	const content = text.slice(start, group.at(-1)?.end);
	const firstTextOffset = start + (content.length - content.trimStart().length);
	const prefix = withPrefix ? getPrefix(firstTextOffset).text : "";
	const embeddingInput = buildEmbeddingInput(content, prefix);
	const tokenCount = countMistralTokens(embeddingInput);

	if (tokenCount <= maxTokens) {
		return [
			{
				content,
				embeddingInput,
				tokenCount,
				usedCharacterFallback: group.some(
					({ usedCharacterFallback }) => usedCharacterFallback,
				),
			},
		];
	}

	const splittable = group.filter(
		({ start: pieceStart, end }) => !isWhitespace(text.slice(pieceStart, end)),
	);
	if (splittable.length > 1) {
		const middle = group.indexOf(splittable[Math.floor(splittable.length / 2)]);
		return [
			...buildChunks(text, group.slice(0, middle), maxTokens, getPrefix),
			...buildChunks(text, group.slice(middle), maxTokens, getPrefix),
		];
	}
	if (prefix) {
		return buildChunks(text, group, maxTokens, getPrefix, false);
	}
	throw new Error(
		`Chunk exceeds the embedding limit (${tokenCount} > ${maxTokens} tokens) and cannot be split further`,
	);
}

/** Lines starting with "|" whose second line is a separator row */
function findTables(text: string): TableBlock[] {
	const lines = text.match(/[^\n]*\n|[^\n]+$/g) ?? [];
	const tables: TableBlock[] = [];
	let lineStart = 0;
	let index = 0;

	while (index < lines.length) {
		if (!TABLE_LINE.test(lines[index])) {
			lineStart += lines[index].length;
			index++;
			continue;
		}
		const blockStart = lineStart;
		const blockLines: string[] = [];
		while (index < lines.length && TABLE_LINE.test(lines[index])) {
			blockLines.push(lines[index]);
			lineStart += lines[index].length;
			index++;
		}
		const hasHeader =
			blockLines.length > 2 && isTableSeparatorLine(blockLines[1].trimEnd());
		if (hasHeader) {
			const [headerLine, separatorLine] = blockLines;
			tables.push({
				header: headerLine + separatorLine,
				headerLine,
				separatorStart: blockStart + headerLine.length,
				bodyStart: blockStart + headerLine.length + separatorLine.length,
				end: lineStart,
			});
		}
	}
	return tables;
}
