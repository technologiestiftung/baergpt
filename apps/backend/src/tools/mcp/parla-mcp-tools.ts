import { createMCPClient, MCPClient } from "@ai-sdk/mcp";
import { tool, type Tool } from "ai";
import { z } from "zod";
import { captureError } from "../../monitoring/capture-error";
import { config } from "../../config";

export interface ParlaMCPToolsResult {
	tools: Record<string, Tool>;
	cleanup: () => Promise<void>;
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
						if (mcpTool.execute) {
							return mcpTool.execute(params, options);
						}
						throw new Error("MCP tool execute function not found");
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
