import React from "react";
import { Document, Page, Text, View, pdf } from "@react-pdf/renderer";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { styles } from "./pdf-export-styles";
import { removeCitationNumbers } from "./utils.ts";

interface MarkdownNode {
	type: string;
	children?: MarkdownNode[];
	value?: string;
	depth?: number;
	url?: string;
	checked?: boolean;
}

type RendererFn = (node: MarkdownNode, idx: number) => React.ReactNode;

function renderChildren(children: unknown[] | undefined) {
	return (
		children?.map((child, i) => renderNode(child as MarkdownNode, i)) ?? null
	);
}

const renderers: Record<string, RendererFn> = {
	heading: (n, idx) => {
		const level = (n.depth ?? 1) as 1 | 2 | 3 | 4 | 5 | 6;
		const headingStyles = {
			1: styles.h1,
			2: styles.h2,
			3: styles.h3,
			4: styles.h4,
			5: styles.h5,
			6: styles.h6,
		};

		return (
			<Text key={idx} style={headingStyles[level] || styles.h4}>
				{renderChildren(n.children)}
			</Text>
		);
	},

	paragraph: (n, idx) => (
		<Text key={idx} style={styles.paragraph}>
			{renderChildren(n.children)}
		</Text>
	),

	text: (n, idx) => <Text key={idx}>{n.value}</Text>,

	strong: (n, idx) => (
		<Text key={idx} style={styles.bold}>
			{renderChildren(n.children)}
		</Text>
	),

	emphasis: (n, idx) => (
		<Text key={idx} style={styles.italic}>
			{renderChildren(n.children)}
		</Text>
	),

	link: (n, idx) => (
		<Text key={idx} style={styles.link}>
			{renderChildren(n.children)} {n.url}
		</Text>
	),

	inlineCode: (n, idx) => (
		<Text key={idx} style={styles.inlineCode}>
			{n.value}
		</Text>
	),

	code: (n, idx) => (
		<View key={idx} style={styles.codeBlock}>
			<Text style={{ fontFamily: "Courier", fontSize: 10 }}>{n.value}</Text>
		</View>
	),

	blockquote: (n, idx) => (
		<View key={idx} style={styles.blockquote}>
			{renderChildren(n.children)}
		</View>
	),

	list: (n, idx) => (
		<View key={idx} style={styles.list}>
			{renderChildren(n.children)}
		</View>
	),

	listItem: (n, idx) => (
		<View key={idx} style={styles.listItem}>
			<Text style={styles.listItemBullet}>{n.checked ? "[x]" : "•"}</Text>
			<View style={{ flex: 1 }}>{renderChildren(n.children)}</View>
		</View>
	),

	table: (n, idx) => (
		<View key={idx} style={styles.table}>
			{n.children?.map((row, rowIdx) => {
				if (rowIdx === 0) {
					// Treat the first row as a header row
					return (
						<View key={rowIdx} style={styles.tableRow}>
							{row.children?.map((cell, cellIdx) =>
								renderers.tableHeader(cell, cellIdx),
							)}
						</View>
					);
				}
				// Render other rows as normal table rows
				return renderers.tableRow(row, rowIdx);
			})}
		</View>
	),

	tableRow: (n, idx) => (
		<View key={idx} style={styles.tableRow}>
			{n.children?.map((child, childIdx) => {
				if (child.type === "tableHeader") {
					return renderers.tableHeader(child, childIdx);
				}
				return renderers.tableCell(child, childIdx);
			})}
		</View>
	),

	tableCell: (n, idx) => (
		<View key={idx} style={styles.tableCell}>
			<Text style={styles.tableCellText}>{renderChildren(n.children)}</Text>
		</View>
	),

	tableHeader: (n, idx) => (
		<View key={idx} style={[styles.tableCell, styles.tableHeader]}>
			<Text style={styles.tableCellText}>{renderChildren(n.children)}</Text>
		</View>
	),
};

function renderNode(node: MarkdownNode, idx: number): React.ReactNode {
	if (!node.type) {
		return null;
	}

	const renderer = renderers[node.type];
	if (renderer) {
		return renderer(node, idx);
	}

	return renderChildren(node.children); // fallback
}

export async function exportMarkdownToPdf(markdown: string, fileName: string) {
	try {
		const cleanMarkdown = removeCitationNumbers(markdown);

		const ast = unified()
			.use(remarkParse)
			.use(remarkGfm)
			.parse(cleanMarkdown) as {
			children?: unknown[];
		};

		const doc = (
			<Document>
				<Page size="A4" style={styles.page}>
					{ast.children?.map((node, idx) =>
						renderNode(node as MarkdownNode, idx),
					)}
				</Page>
			</Document>
		);

		const blob = await pdf(doc).toBlob();

		// Download
		const link = document.createElement("a");
		link.href = URL.createObjectURL(blob);
		link.download = `${fileName}.pdf`;
		link.click();
	} catch (error) {
		const { captureError } = await import(
			"../../../../monitoring/capture-error.ts"
		);
		const { useErrorStore } = await import("../../../../store/error-store.ts");
		captureError(error);
		useErrorStore.getState().setError("chat_export_failed");
	}
}
