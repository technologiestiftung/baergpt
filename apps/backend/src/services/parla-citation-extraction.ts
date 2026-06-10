import { z } from "zod";

export type ParlaChunkData = {
	id: number;
	content: string;
	page: number;
	url: string;
	title: string;
	source_type: string;
};

const parlaResponseSchema = z.object({
	documentMatches: z.array(
		z.object({
			registered_document: z.object({
				source_url: z.string(),
				source_type: z.string(),
				metadata: z.record(z.string(), z.unknown()).nullable(),
			}),
			processed_document_chunk_matches: z.array(
				z.object({
					processed_document_chunk: z.object({
						id: z.number(),
						content: z.string(),
						page: z.number(),
					}),
				}),
			),
		}),
	),
});

// TODO: once the Parla MCP server returns structuredContent, tr.output will
// be the structured data directly and this entire function can be replaced
// with: parlaResponseSchema.safeParse(output)
export function parseParlaToolOutput(output: unknown): ParlaChunkData[] {
	const raw = output as { content?: { type: string; text: string }[] } | null;
	const items: { type: string; text: string }[] = Array.isArray(output)
		? output
		: (raw?.content ?? []);

	const text = items.find((item) => item.type === "text")?.text;
	if (!text) {
		return [];
	}

	const jsonStart = text.indexOf("{");
	if (jsonStart === -1) {
		return [];
	}

	try {
		const parsed = parlaResponseSchema.safeParse(
			JSON.parse(text.slice(jsonStart)),
		);
		if (!parsed.success) {
			return [];
		}

		return parsed.data.documentMatches.flatMap((match) =>
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
