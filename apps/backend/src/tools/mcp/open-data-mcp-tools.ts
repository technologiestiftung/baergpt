import { createMCPClient, MCPClient } from "@ai-sdk/mcp";
import { tool, type Tool } from "ai";
import { z } from "zod";

export interface OpenDataMCPToolsResult {
	tools: Record<string, Tool>;
	cleanup: () => Promise<void>;
}

export const openDataMCPTools =
	async (): Promise<OpenDataMCPToolsResult | null> => {
		let openDataHttpClient: MCPClient | undefined;
		try {
			openDataHttpClient = await createMCPClient({
				transport: {
					type: "http",
					url: "https://bod-mcp.up.railway.app/mcp",
				},
			});

			const openDataHttpClientToolSet = await openDataHttpClient.tools();

			// Wrap MCP tools with proper Zod validation
			// The MCP SDK returns tools with JSON Schema, but the AI SDK needs proper Zod schemas
			const wrappedTools: Record<string, Tool> = {};

			for (const [toolName, mcpTool] of Object.entries(
				openDataHttpClientToolSet,
			)) {
				if (toolName === "search_berlin_datasets") {
					wrappedTools[toolName] = tool({
						description: mcpTool.description,
						// @ts-expect-error Weird Vercel AI SDK issue with Zod and types
						inputSchema: z.object({
							query: z
								.string()
								.describe("Natural language search query in German or English"),
							limit: z
								.number()
								.optional()
								.describe("Maximum number of results to return (default: 20)"),
							sort: z
								.string()
								.optional()
								.describe("Optional CKAN sort expression (e.g. 'score desc')"),
						}),
						// @ts-expect-error Weird Vercel AI SDK issue with Zod and types
						execute: async (params, options) => {
							if (mcpTool.execute) {
								return await mcpTool.execute(params, options);
							}
							throw new Error("MCP tool execute function not found");
						},
					});
				} else if (toolName === "get_dataset_details") {
					wrappedTools[toolName] = tool({
						description: mcpTool.description,
						// @ts-expect-error Weird Vercel AI SDK issue with Zod and types
						inputSchema: z.object({
							dataset_id: z.string().describe("The ID or name of the dataset"),
						}),
						// @ts-expect-error Weird Vercel AI SDK issue with Zod and types
						execute: async (params, options) => {
							if (mcpTool.execute) {
								return await mcpTool.execute(params, options);
							}
							throw new Error("MCP tool execute function not found");
						},
					});
				} else if (toolName === "fetch_dataset_data") {
					wrappedTools[toolName] = tool({
						description: mcpTool.description,
						// @ts-expect-error Weird Vercel AI SDK issue with Zod and types
						inputSchema: z.object({
							dataset_id: z.string().describe("The dataset ID or name"),
							resource_id: z
								.string()
								.optional()
								.describe(
									"Optional: specific resource ID. If not provided, uses first available resource.",
								),
							full_data: z
								.boolean()
								.optional()
								.describe(
									"If true, return all data for small datasets (≤500 rows). Refused for large datasets.",
								),
						}),
						// @ts-expect-error Weird Vercel AI SDK issue with Zod and types
						execute: async (params, options) => {
							if (mcpTool.execute) {
								return await mcpTool.execute(params, options);
							}
							throw new Error("MCP tool execute function not found");
						},
					});
				} else if (toolName === "list_all_datasets") {
					wrappedTools[toolName] = tool({
						description: mcpTool.description,
						// @ts-expect-error Weird Vercel AI SDK issue with Zod and types
						inputSchema: z.object({
							offset: z
								.number()
								.optional()
								.describe("Starting position (default: 0)"),
							limit: z
								.number()
								.optional()
								.describe(
									"Number of results to return (default: 100, max: 1000)",
								),
						}),
						// @ts-expect-error Weird Vercel AI SDK issue with Zod and types
						execute: async (params, options) => {
							if (mcpTool.execute) {
								return await mcpTool.execute(params, options);
							}
							throw new Error("MCP tool execute function not found");
						},
					});
				} else if (toolName === "download_dataset") {
					wrappedTools[toolName] = tool({
						description: mcpTool.description,
						// @ts-expect-error Weird Vercel AI SDK issue with Zod and types
						inputSchema: z.object({
							dataset_id: z.string().describe("The dataset ID or name"),
							resource_id: z
								.string()
								.optional()
								.describe(
									"Optional: specific resource ID. If not provided, uses first available data resource.",
								),
							format: z
								.enum(["csv", "json", "geojson"])
								.optional()
								.describe(
									"Output format: csv, json, or geojson. Use geojson for geodata.",
								),
						}),
						// @ts-expect-error Weird Vercel AI SDK issue with Zod and types
						execute: async (params, options) => {
							if (mcpTool.execute) {
								return await mcpTool.execute(params, options);
							}
							throw new Error("MCP tool execute function not found");
						},
					});
				} else if (toolName === "get_portal_stats") {
					wrappedTools[toolName] = tool({
						description: mcpTool.description,
						// @ts-expect-error Weird Vercel AI SDK issue with Zod and types
						inputSchema: z.object({}),
						// @ts-expect-error Weird Vercel AI SDK issue with Zod and types
						execute: async (params, options) => {
							if (mcpTool.execute) {
								return await mcpTool.execute(params, options);
							}
							throw new Error("MCP tool execute function not found");
						},
					});
				} else if (toolName === "get_facets") {
					wrappedTools[toolName] = tool({
						description: mcpTool.description,
						// @ts-expect-error Weird Vercel AI SDK issue with Zod and types
						inputSchema: z.object({
							query: z
								.string()
								.optional()
								.describe("Search query to scope facets to (default: '*')"),
							limit: z
								.number()
								.optional()
								.describe(
									"Maximum number of facet values to return (default: 10, max: 50)",
								),
						}),
						// @ts-expect-error Weird Vercel AI SDK issue with Zod and types
						execute: async (params, options) => {
							if (mcpTool.execute) {
								return await mcpTool.execute(params, options);
							}
							throw new Error("MCP tool execute function not found");
						},
					});
				} else if (toolName === "list_tags") {
					wrappedTools[toolName] = tool({
						description: mcpTool.description,
						// @ts-expect-error Weird Vercel AI SDK issue with Zod and types
						inputSchema: z.object({
							query: z
								.string()
								.optional()
								.describe("Optional filter to search tag names"),
							limit: z
								.number()
								.optional()
								.describe(
									"Maximum number of tags to return (default: 50, max: 100)",
								),
						}),
						// @ts-expect-error Weird Vercel AI SDK issue with Zod and types
						execute: async (params, options) => {
							if (mcpTool.execute) {
								return await mcpTool.execute(params, options);
							}
							throw new Error("MCP tool execute function not found");
						},
					});
				} else if (toolName === "list_geo_layers") {
					wrappedTools[toolName] = tool({
						description: mcpTool.description,
						// @ts-expect-error Weird Vercel AI SDK issue with Zod and types
						inputSchema: z.object({
							dataset_id: z
								.string()
								.describe("The ID or name of the dataset with a WFS resource"),
						}),
						// @ts-expect-error Weird Vercel AI SDK issue with Zod and types
						execute: async (params, options) => {
							if (mcpTool.execute) {
								return await mcpTool.execute(params, options);
							}
							throw new Error("MCP tool execute function not found");
						},
					});
				} else if (toolName === "fetch_geo_features") {
					wrappedTools[toolName] = tool({
						description: mcpTool.description,
						// @ts-expect-error Weird Vercel AI SDK issue with Zod and types
						inputSchema: z.object({
							wfs_url: z.string().describe("The WFS service URL"),
							typename: z
								.string()
								.describe("The WFS layer/type name to fetch features from"),
							limit: z
								.number()
								.optional()
								.describe(
									"Maximum number of features to return (default: 100, max: 5000)",
								),
							property_filter: z
								.string()
								.optional()
								.describe(
									"Optional CQL filter on feature properties (e.g. \"bezirk = 'Mitte'\")",
								),
						}),
						// @ts-expect-error Weird Vercel AI SDK issue with Zod and types
						execute: async (params, options) => {
							if (mcpTool.execute) {
								return await mcpTool.execute(params, options);
							}
							throw new Error("MCP tool execute function not found");
						},
					});
				} else if (toolName === "aggregate_dataset") {
					wrappedTools[toolName] = tool({
						description: mcpTool.description,
						// @ts-expect-error Weird Vercel AI SDK issue with Zod and types
						inputSchema: z.object({
							dataset_id: z.string().describe("The dataset ID or name"),
							resource_id: z
								.string()
								.optional()
								.describe(
									"Optional: specific resource ID. If not provided, uses first available resource.",
								),
							group_by: z
								.array(z.string())
								.optional()
								.describe("Columns to group results by"),
							metrics: z
								.array(
									z.object({
										op: z
											.enum([
												"sum",
												"avg",
												"min",
												"max",
												"count",
												"count_distinct",
											])
											.describe("Aggregation operation"),
										column: z
											.string()
											.optional()
											.describe("Column to aggregate (not needed for 'count')"),
										as: z
											.string()
											.optional()
											.describe("Optional alias for the resulting column"),
									}),
								)
								.describe("At least one aggregation metric to compute"),
							filters: z
								.array(
									z.object({
										column: z.string(),
										op: z.enum([
											"eq",
											"neq",
											"gt",
											"gte",
											"lt",
											"lte",
											"contains",
											"in",
										]),
										value: z.unknown(),
									}),
								)
								.optional()
								.describe("Filters applied before aggregation"),
							sort: z
								.array(
									z.object({
										column: z.string(),
										direction: z.enum(["asc", "desc"]).optional(),
									}),
								)
								.optional()
								.describe("Sort order for the aggregated result rows"),
							limit: z
								.number()
								.optional()
								.describe(
									"Maximum number of result rows to return (default: 1000, max: 1000)",
								),
						}),
						// @ts-expect-error Weird Vercel AI SDK issue with Zod and types
						execute: async (params, options) => {
							if (mcpTool.execute) {
								return await mcpTool.execute(params, options);
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
				cleanup: async () => {
					await Promise.all([openDataHttpClient?.close()]);
				},
			};
		} catch (error) {
			console.error("Error initializing MCP client:", error);
			return null;
		}
	};
