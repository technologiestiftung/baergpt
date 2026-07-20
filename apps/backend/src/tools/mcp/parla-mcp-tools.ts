import { createMCPClient, MCPClient } from "@ai-sdk/mcp";
import { type Tool } from "ai";
import { z } from "zod";
import { captureError } from "../../monitoring/capture-error";
import { config } from "../../config";

export interface ParlaMCPToolsResult {
	tools: Record<string, Tool>;
	cleanup: () => Promise<void>;
}

export type ParlaChunkData = {
	id: number;
	content: string;
	page: number;
	url: string;
	title: string;
	source_type: string;
};

export const parlaResponseSchema = z.object({
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

export const parlaMCPTools = async (): Promise<ParlaMCPToolsResult | null> => {
	let parlaHttpClient: MCPClient | undefined;
	try {
		parlaHttpClient = await createMCPClient({
			transport: {
				type: "http",
				url: config.mcpParlaUrl,
			},
		});

		// Schema mode (vs "automatic") makes the client validate against
		// outputSchema and expose the server's structuredContent as the tool
		// output. Caveat: only the listed tools are returned — others (e.g.
		// health_check) are dropped.
		const tools = await parlaHttpClient.tools({
			schemas: {
				parla_vector_search: {
					inputSchema: z.object({
						query: z.string().describe("The search query"),
						match_threshold: z
							.number()
							.min(0)
							.max(1)
							.optional()
							.describe("Match threshold (0-1, default 0.7)"),
						num_probes_chunks: z
							.number()
							.optional()
							.describe("Number of chunk probes (default 8)"),
						num_probes_summaries: z
							.number()
							.max(9)
							.optional()
							.describe("Number of summary probes (default 8, max 9)"),
						chunk_limit: z
							.number()
							.optional()
							.describe("Maximum chunks to return (default 10)"),
						summary_limit: z
							.number()
							.optional()
							.describe("Maximum summaries to return (default 5)"),
						document_limit: z
							.number()
							.optional()
							.describe("Maximum documents to return (default 3)"),
					}),
					outputSchema: parlaResponseSchema,
				},
			},
		});

		return {
			tools,
			cleanup: async () => await parlaHttpClient?.close(),
		};
	} catch (error) {
		captureError(error);

		if (!parlaHttpClient) {
			return null;
		}

		try {
			await parlaHttpClient.close();
		} catch (closeError) {
			captureError(closeError);
		}

		return null;
	}
};

export function parseParlaToolOutput(output: unknown): ParlaChunkData[] {
	const parsed = parlaResponseSchema.safeParse(output);
	if (!parsed.success) {
		captureError(parsed.error);
		return [];
	}

	return parsed.data.documentMatches.flatMap((match) =>
		match.processed_document_chunk_matches.map((chunkMatch) => ({
			id: chunkMatch.processed_document_chunk.id,
			content: chunkMatch.processed_document_chunk.content,
			page: chunkMatch.processed_document_chunk.page,
			url: match.registered_document.source_url,
			title:
				(match.registered_document.metadata?.["title"] as string | undefined) ??
				match.registered_document.source_url,
			source_type: match.registered_document.source_type,
		})),
	);
}
