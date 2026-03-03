import { createMCPClient, MCPClient } from "@ai-sdk/mcp";
import { tool, type Tool } from "ai";
import { z } from "zod";
import { captureError } from "../../monitoring/capture-error";
import { config } from "../../config";

export interface ParlaMCPToolsResult {
	tools: Record<string, Tool>;
	cleanup: () => Promise<void>;
}

export interface ParlaCitation {
	id?: string;
	snippet: string;
	page: number;
	fileName: string;
	sourceUrl: string;
	createdAt: string;
	sourceType: "parla_document";
}

interface ParlaDocumentMatch {
	registered_document: {
		source_url: string;
		source_type: string;
		registered_at: string;
		id: number;
		metadata: Record<string, unknown>;
	};
	processed_document: {
		file_checksum: string;
		file_size: number;
		num_pages: number;
		id: number;
		processing_started_at: string;
		processing_finished_at: string;
		processing_error: string;
		registered_document_id: number;
	};
	processed_document_summary_match?: {
		processed_document_summary: {
			id: number;
			summary: string;
			tags: string[];
			processed_document_id: number;
		};
		similarity: number;
	};
	processed_document_chunk_matches: Array<{
		processed_document_chunk: {
			id: number;
			content: string;
			page: number;
			processed_document_id: number;
		};
		similarity: number;
	}>;
	similarity: number;
}

interface ParlaVectorSearchResult {
	documentMatches: ParlaDocumentMatch[];
	userRequestId: string;
}

/**
 * Extract citation information from Parla document matches
 */
function extractParlaCitations(
	documentMatches: ParlaDocumentMatch[],
): ParlaCitation[] {
	const citations: ParlaCitation[] = [];

	for (const match of documentMatches) {
		try {
			const { registered_document, processed_document_chunk_matches } = match;

			// Get the document title from metadata
			const fileName =
				(registered_document.metadata?.Titel as string[])?.[0] ||
				"Parla Document";

			// Extract citations from chunk matches only (not summaries to avoid hallucinations)
			if (
				processed_document_chunk_matches &&
				processed_document_chunk_matches.length > 0
			) {
				for (const chunkMatch of processed_document_chunk_matches) {
					const chunk = chunkMatch.processed_document_chunk;
					citations.push({
						id: `parla-${registered_document.id}-${chunk.id}`,
						snippet: chunk.content,
						page: chunk.page,
						fileName,
						sourceUrl: registered_document.source_url,
						createdAt: registered_document.registered_at,
						sourceType: "parla_document",
					});
				}
			}
		} catch (error) {
			captureError(error);
		}
	}

	return citations;
}

export const parlaMCPTools = async (): Promise<ParlaMCPToolsResult | null> => {
	let parlaHttpClient: MCPClient | undefined;
	try {
		parlaHttpClient = await createMCPClient({
			transport: {
				type: "http",
				url: config.mcpParlaUrl,
			},
		});

		const parlaHttpClientToolSet = await parlaHttpClient.tools();

		// Wrap MCP tools with proper Zod validation
		// The MCP SDK returns tools with JSON Schema, but the AI SDK needs proper Zod schemas
		const wrappedTools: Record<string, Tool> = {};

		for (const [toolName, mcpTool] of Object.entries(parlaHttpClientToolSet)) {
			if (toolName === "parla_vector_search") {
				wrappedTools[toolName] = tool({
					description: mcpTool.description || "Vector search tool",
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
					execute: async (params, options) => {
						if (!mcpTool.execute) {
							throw new Error("MCP tool execute function not found");
						}

						// Execute the original MCP tool
						const result = await mcpTool.execute(params, options);

						// Parse the result to extract citations
						let documentMatches: ParlaDocumentMatch[] = [];
						if (result && typeof result === "object" && "content" in result) {
							const content = (result as { content: Array<{ text?: string }> })
								.content;
							if (content && content.length > 0 && content[0].text) {
								try {
									const parsedText = content[0].text.replace(
										/^Vector search results:\s*/,
										"",
									);
									const parsed: ParlaVectorSearchResult =
										JSON.parse(parsedText);
									documentMatches = parsed.documentMatches || [];
								} catch (parseError) {
									captureError(parseError);
								}
							}
						}

						// Extract citations from Parla response
						const parlaCitations = extractParlaCitations(documentMatches);

						// Return the original result with added parlaCitations for the generation service
						return {
							...result,
							parlaCitations,
						};
					},
				});
			} else {
				// For other tools, use them as-is
				wrappedTools[toolName] = mcpTool as Tool;
			}
		}

		// Return tools and cleanup function instead of closing immediately
		return {
			tools: wrappedTools,
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
