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

export type ParlaResponse = z.infer<typeof parlaResponseSchema>;

export const parlaVectorSearchInputSchema = z.object({
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
});

export type ParlaVectorSearchInput = z.infer<
	typeof parlaVectorSearchInputSchema
>;

export const parlaMCPTools = async (): Promise<ParlaMCPToolsResult | null> => {
	let parlaHttpClient: MCPClient | undefined;
	try {
		parlaHttpClient = await createMCPClient({
			transport: {
				type: "http",
				url: config.mcpParlaUrl,
			},
		});

		// Schema mode validates against outputSchema and exposes the server's
		// structuredContent as the tool output. Only listed tools are returned.
		const tools = await parlaHttpClient.tools({
			schemas: {
				parla_vector_search: {
					inputSchema: parlaVectorSearchInputSchema,
					outputSchema: parlaResponseSchema,
				},
			},
		});

		for (const tool of Object.values(tools)) {
			const originalExecute = tool.execute;
			if (originalExecute) {
				tool.execute = (async (...args: Parameters<typeof originalExecute>) => {
					try {
						return await originalExecute(...args);
					} catch (error) {
						captureError(error);
						return { documentMatches: [] };
					}
				}) as typeof originalExecute;
			}
		}

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

export function parseParlaToolOutput(output: ParlaResponse): ParlaChunkData[] {
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
