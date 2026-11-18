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
