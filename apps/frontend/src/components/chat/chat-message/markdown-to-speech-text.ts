import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";

type MarkdownNode = {
	type: string;
	value?: string;
	alt?: string | null;
	children?: MarkdownNode[];
};

// Nodes that would sound like noise when read aloud.
const SKIPPED_NODES = new Set([
	"code",
	"html",
	"definition",
	"footnoteDefinition",
]);
// Nodes after which the reader should pause.
const BLOCK_NODES = new Set([
	"paragraph",
	"heading",
	"listItem",
	"tableRow",
	"blockquote",
]);

function collectText(node: MarkdownNode, parts: string[]) {
	if (SKIPPED_NODES.has(node.type)) {
		return;
	}
	if (node.type === "text" || node.type === "inlineCode") {
		parts.push(node.value ?? "");
		return;
	}
	if (node.type === "image" && node.alt) {
		parts.push(node.alt);
		return;
	}
	if (node.type === "break") {
		parts.push("\n");
		return;
	}
	if (node.type === "tableCell") {
		node.children?.forEach((child) => collectText(child, parts));
		parts.push(", ");
		return;
	}

	node.children?.forEach((child) => collectText(child, parts));

	if (BLOCK_NODES.has(node.type)) {
		parts.push("\n\n");
	}
}

/**
 * Turns an answer's markdown into plain text for TTS: drops formatting
 * characters, code blocks and HTML, and keeps paragraph breaks as pauses.
 */
export function markdownToSpeechText(markdown: string): string {
	const tree = unified()
		.use(remarkParse)
		.use(remarkGfm)
		.parse(markdown) as MarkdownNode;

	const parts: string[] = [];
	collectText(tree, parts);

	return parts
		.join("")
		.replace(/[ \t]+/g, " ")
		.replace(/ ?, (\n|$)/g, "$1")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

// Upper bound per TTS request. Longer chunks take longer before playback.
const MAX_CHUNK_CHARS = 600;

function splitIntoSentences(paragraph: string): string[] {
	return (
		paragraph.match(/[^.!?]+[.!?]+["'»«“”)]*\s*|[^.!?]+$/g) ?? [paragraph]
	).map((sentence) => sentence.trim());
}

function packPieces(pieces: string[], separator: string): string[] {
	const chunks: string[] = [];
	for (const piece of pieces) {
		const last = chunks.at(-1);
		if (
			last &&
			last.length + separator.length + piece.length <= MAX_CHUNK_CHARS
		) {
			chunks[chunks.length - 1] = `${last}${separator}${piece}`;
		} else {
			chunks.push(piece);
		}
	}
	return chunks;
}

/**
 * Splits speech text into chunks for sequential TTS requests. The first
 * paragraph stays alone so playback starts quickly; the rest is packed into
 * chunks of up to MAX_CHUNK_CHARS, split at sentence ends if needed.
 */
export function splitSpeechText(text: string): string[] {
	const pieces = text
		.split(/\n{2,}/)
		.map((paragraph) => paragraph.trim())
		.filter(Boolean)
		.flatMap((paragraph) =>
			paragraph.length > MAX_CHUNK_CHARS
				? packPieces(splitIntoSentences(paragraph).filter(Boolean), " ")
				: [paragraph],
		);

	const [first, ...rest] = pieces;
	return first ? [first, ...packPieces(rest, "\n\n")] : [];
}
