import { createMCPClient, MCPClient } from "@ai-sdk/mcp";
import { tool, type Tool } from "ai";
import { z } from "zod";

import { config } from "../../config";

export interface DatawrapperMCPToolsResult {
	tools: Record<string, Tool>;
	cleanup: () => Promise<void>;
}

export const datawrapperMCPTools =
	async (): Promise<DatawrapperMCPToolsResult | null> => {
		let datawrapperHttpClient: MCPClient | undefined;
		try {
			const headers = config.datawrapperAccessToken
				? { Authorization: `Bearer ${config.datawrapperAccessToken}` }
				: undefined;
			datawrapperHttpClient = await createMCPClient({
				transport: {
					type: "http",
					url: "https://datawrapper-mcp.up.railway.app/mcp",
					headers,
				},
			});

			const datawrapperHttpClientToolSet = await datawrapperHttpClient.tools();

			// Wrap MCP tools with proper Zod validation
			// The MCP SDK returns tools with JSON Schema, but the AI SDK needs proper Zod schemas
			const wrappedTools: Record<string, Tool> = {};

			for (const [toolName, mcpTool] of Object.entries(
				datawrapperHttpClientToolSet,
			)) {
				if (toolName === "create_visualization") {
					wrappedTools[toolName] = tool({
						description:
							mcpTool.description ||
							"Create a Datawrapper visualization (not published)",
						// @ts-expect-error Weird Vercel AI SDK issue with Zod and types
						inputSchema: z.object({
							data: z.union([
								z
									.array(z.record(z.string(), z.unknown()))
									.describe("Array of data objects"),
								z
									.object({
										type: z.literal("FeatureCollection"),
										features: z.array(z.unknown()),
									})
									.describe("GeoJSON FeatureCollection"),
							]),
							chart_type: z
								.enum([
									"bar",
									"column",
									"line",
									"area",
									"scatter",
									"dot",
									"range",
									"arrow",
									"pie",
									"donut",
									"election-donut",
									"table",
									"map",
								])
								.describe("Type of visualization to create"),
							variant: z
								.enum(["basic", "stacked", "grouped", "split"])
								.optional()
								.describe(
									"Chart variant. Bar: basic/stacked/split. Column: basic/grouped/stacked.",
								),
							map_type: z
								.enum(["d3-maps-symbols", "d3-maps-choropleth"])
								.optional()
								.describe(
									"Required when chart_type is map. Symbols for GeoJSON points, choropleth for regions.",
								),
							basemap: z
								.enum([
									"berlin-boroughs",
									"berlin-prognoseraume-2021",
									"berlin-bezreg-2021",
									"berlin-planungsraeume-2021",
								])
								.optional()
								.describe(
									"Basemap for choropleth maps. Auto-detected if omitted.",
								),
							region_column: z
								.string()
								.optional()
								.describe("Column with region IDs/names for choropleth maps."),
							value_column: z
								.string()
								.optional()
								.describe("Column with values for choropleth maps."),
							title: z.string().optional().describe("Optional chart title"),
							description: z
								.string()
								.optional()
								.describe("Optional chart description/byline"),
							source_dataset_id: z
								.string()
								.optional()
								.describe("Optional Berlin dataset ID for tracking"),
						}),
						// @ts-expect-error Weird Vercel AI SDK issue with Zod and types
						execute: async (params, options) => {
							if (mcpTool.execute) {
								return await mcpTool.execute(params, options);
							}
							throw new Error("MCP tool execute function not found");
						},
					});
				} else if (toolName === "publish_visualization") {
					wrappedTools[toolName] = tool({
						description:
							mcpTool.description || "Publish a Datawrapper visualization",
						// @ts-expect-error Weird Vercel AI SDK issue with Zod and types
						inputSchema: z.object({
							chart_id: z
								.string()
								.describe("The chart ID returned from create_visualization"),
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
					await Promise.all([datawrapperHttpClient?.close()]);
				},
			};
		} catch (error) {
			console.error("Error initializing MCP client:", error);
			return null;
		}
	};
