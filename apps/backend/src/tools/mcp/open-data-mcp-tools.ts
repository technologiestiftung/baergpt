import { createMCPClient, MCPClient } from "@ai-sdk/mcp";
import { tool, type Tool } from "ai";
import { z } from "zod";

export interface OpenDataMCPToolsResult {
	tools: Record<string, Tool>;
	cleanup: () => Promise<void>;
}

export type OpenDataCitationSource = {
	url: string;
	title: string;
	datasetId: string;
};

/**
 * Names of tools that reference a specific Berlin dataset in their
 * response and are therefore eligible for source-citation extraction.
 */
export const OPEN_DATA_DATASET_TOOL_NAMES = new Set([
	"search_berlin_datasets",
	"search_datasets_filtered",
	"get_dataset_details",
	"fetch_dataset_data",
	"download_dataset",
	"aggregate_dataset",
	"list_geo_layers",
]);

const DATASET_URL_PREFIX = "https://daten.berlin.de/datensaetze/";

/**
 * `search_berlin_datasets` / `search_datasets_filtered` render one markdown block per result, e.g.:
 *   ## 1. Some Dataset Title
 *   **ID**: some-dataset-id
 *   **URL**: https://daten.berlin.de/datensaetze/some-dataset-id
 */
const SEARCH_RESULT_PATTERN =
	/##\s*\d+\.\s*(.+?)\n\*\*ID\*\*:\s*(\S+)\n\*\*URL\*\*:\s*(https:\/\/daten\.berlin\.de\/datensaetze\/\S+)/g;

/**
 * `get_dataset_details` renders a single markdown block, e.g.:
 *   # Some Dataset Title
 *
 *   ## Overview
 *   **ID**: some-dataset-id
 *   **Portal URL**: https://daten.berlin.de/datensaetze/some-dataset-id
 */
const DATASET_DETAILS_PATTERN =
	/^#\s*(.+?)\n\n## Overview\n\*\*ID\*\*:\s*(\S+)\n\*\*Portal URL\*\*:\s*(https:\/\/daten\.berlin\.de\/datensaetze\/\S+)/;

function extractTextFromMcpOutput(output: unknown): string | null {
	if (
		typeof output !== "object" ||
		output === null ||
		!("content" in output) ||
		!Array.isArray((output as { content: unknown }).content)
	) {
		return null;
	}

	const textPart = (
		output as { content: Array<{ type?: string; text?: string }> }
	).content.find(
		(part) => part?.type === "text" && typeof part.text === "string",
	);

	return textPart?.text ?? null;
}

function extractDatasetIdFromInput(input: unknown): string | null {
	if (typeof input !== "object" || input === null || !("dataset_id" in input)) {
		return null;
	}

	const datasetId = (input as { dataset_id?: unknown }).dataset_id;
	return typeof datasetId === "string" && datasetId.length > 0
		? datasetId
		: null;
}

/**
 * Extracts the Berlin Open Data dataset(s) referenced by a tool call so they
 * can be surfaced as sources. The upstream MCP server returns plain markdown text
 * rather than structured JSON, so we parse them above.
 * For tools that reference a dataset by ID but don't repeat its title/URL in the
 * response text (e.g. large tabular previews) we fall back to constructing the
 * citation from the tool's input.
 */
export function extractOpenDataSourcesFromToolOutput(
	input: unknown,
	output: unknown,
): OpenDataCitationSource[] {
	const text = extractTextFromMcpOutput(output);

	const searchMatches = text
		? [...text.matchAll(SEARCH_RESULT_PATTERN)].map((match) => ({
				title: match[1].trim(),
				datasetId: match[2].trim(),
				url: match[3].trim(),
			}))
		: [];

	if (searchMatches.length > 0) {
		return searchMatches;
	}

	const detailsMatch = text?.match(DATASET_DETAILS_PATTERN);
	if (detailsMatch) {
		return [
			{
				title: detailsMatch[1].trim(),
				datasetId: detailsMatch[2].trim(),
				url: detailsMatch[3].trim(),
			},
		];
	}

	const datasetId = extractDatasetIdFromInput(input);
	if (!datasetId) {
		return [];
	}

	const titleMatch = text?.match(/^#\s*(?:Data from:\s*)?(.+)$/m);

	return [
		{
			url: `${DATASET_URL_PREFIX}${datasetId}`,
			title: titleMatch?.[1]?.trim() ?? datasetId,
			datasetId,
		},
	];
}

export const openDataMCPTools =
	async (): Promise<OpenDataMCPToolsResult | null> => {
		let openDataHttpClient: MCPClient | undefined;
		try {
			openDataHttpClient = await createMCPClient({
				transport: {
					type: "http",
					url: "https://berlin-open-data-mcp.onrender.com/mcp",
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
						inputSchema: z.object({
							dataset_id: z.string().describe("The ID or name of the dataset"),
						}),
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
						inputSchema: z.object({}),
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
						inputSchema: z.object({
							dataset_id: z
								.string()
								.describe("The ID or name of the dataset with a WFS resource"),
						}),
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
						execute: async (params, options) => {
							if (mcpTool.execute) {
								return await mcpTool.execute(params, options);
							}
							throw new Error("MCP tool execute function not found");
						},
					});
				} else {
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
