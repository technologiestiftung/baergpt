export type ParlaChunkData = {
	id: number;
	content: string;
	page: number;
	url: string;
	title: string;
	source_type: string;
};

function extractItems(output: unknown): unknown[] | null {
	if (Array.isArray(output)) {
		return output;
	}
	const wrapped = (output as { content?: unknown })?.content;
	return Array.isArray(wrapped) ? (wrapped as unknown[]) : null;
}

export function parseParlaToolOutput(output: unknown): ParlaChunkData[] {
	const items = extractItems(output);
	if (!items) {
		return [];
	}
	const textItem = (items as Array<{ type: string; text: string }>).find(
		(item) => item.type === "text",
	);
	if (!textItem) {
		return [];
	}
	const jsonStart = textItem.text.indexOf("{");
	if (jsonStart === -1) {
		return [];
	}
	try {
		const parsed = JSON.parse(textItem.text.slice(jsonStart)) as {
			documentMatches: Array<{
				registered_document: {
					source_url: string;
					source_type: string;
					metadata: Record<string, unknown> | null;
				};
				processed_document_chunk_matches: Array<{
					processed_document_chunk: {
						id: number;
						content: string;
						page: number;
					};
				}>;
			}>;
		};
		return parsed.documentMatches.flatMap((match) =>
			match.processed_document_chunk_matches.map((chunkMatch) => ({
				id: chunkMatch.processed_document_chunk.id,
				content: chunkMatch.processed_document_chunk.content,
				page: chunkMatch.processed_document_chunk.page,
				url: match.registered_document.source_url,
				title:
					(match.registered_document.metadata?.["title"] as
						| string
						| undefined) ?? match.registered_document.source_url,
				source_type: match.registered_document.source_type,
			})),
		);
	} catch {
		return [];
	}
}
