import { createMCPClient, MCPClient } from "@ai-sdk/mcp";
import { tool, type Tool } from "ai";
import { z } from "zod";
import { config } from "../../config";
import { captureError } from "../../monitoring/capture-error";

export interface OpenDataMCPToolsResult {
	tools: Record<string, Tool>;
	cleanup: () => Promise<void>;
}

export type OpenDataCitationSource = {
	url: string;
	title: string;
	datasetId: string;
};

const aggregateFilterValueSchema = z.union([
	z.string(),
	z.number(),
	z.boolean(),
	z.array(z.union([z.string(), z.number()])),
]);

const aggregateMetricSchema = z.object({
	op: z.enum(["sum", "avg", "min", "max", "count", "count_distinct"]),
	column: z.string().optional(),
	as: z.string().optional(),
});

const aggregateFilterSchema = z.object({
	column: z.string(),
	op: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "contains", "in"]),
	value: aggregateFilterValueSchema,
});

const aggregateSortSchema = z.object({
	column: z.string(),
	direction: z.enum(["asc", "desc"]).optional(),
});

export const searchBerlinDatasetsInputSchema = z.object({
	query: z.string(),
	limit: z.number().optional(),
	sort: z.string().optional(),
});

export const searchDatasetsFilteredInputSchema = z.object({
	query: z.string().optional(),
	organization: z.string().optional(),
	tag: z.string().optional(),
	format: z.string().optional(),
	modified_since: z.string().optional(),
	sort: z.string().optional(),
	rows: z.number().optional(),
});

export const getDatasetDetailsInputSchema = z.object({
	dataset_id: z.string(),
});

export const fetchDatasetDataInputSchema = z.object({
	dataset_id: z.string(),
	resource_id: z.string().optional(),
	full_data: z.boolean().optional(),
});

export const listAllDatasetsInputSchema = z.object({
	offset: z.number().optional(),
	limit: z.number().optional(),
});

export const downloadDatasetInputSchema = z.object({
	dataset_id: z.string(),
	resource_id: z.string().optional(),
	format: z.enum(["csv", "json", "geojson"]).optional(),
});

export const getPortalStatsInputSchema = z.object({});

export const getFacetsInputSchema = z.object({
	query: z.string().optional(),
	limit: z.number().optional(),
});

export const listTagsInputSchema = z.object({
	query: z.string().optional(),
	limit: z.number().optional(),
});

export const listGeoLayersInputSchema = z.object({
	dataset_id: z.string(),
});

export const fetchGeoFeaturesInputSchema = z.object({
	wfs_url: z.string(),
	typename: z.string(),
	limit: z.number().optional(),
	property_filter: z.string().optional(),
});

export const aggregateDatasetInputSchema = z.object({
	dataset_id: z.string(),
	resource_id: z.string().optional(),
	group_by: z.array(z.string()).optional(),
	metrics: z.array(aggregateMetricSchema),
	filters: z.array(aggregateFilterSchema).optional(),
	sort: z.array(aggregateSortSchema).optional(),
	limit: z.number().optional(),
});

export const openDataToolInputSchema = z.union([
	getDatasetDetailsInputSchema,
	fetchDatasetDataInputSchema,
	downloadDatasetInputSchema,
	listGeoLayersInputSchema,
	aggregateDatasetInputSchema,
	fetchGeoFeaturesInputSchema,
	searchBerlinDatasetsInputSchema,
	searchDatasetsFilteredInputSchema,
	getFacetsInputSchema,
	listTagsInputSchema,
	listAllDatasetsInputSchema,
	getPortalStatsInputSchema,
]);

export type OpenDataToolInput = z.infer<typeof openDataToolInputSchema>;

export const openDataMcpTextContentSchema = z.object({
	type: z.literal("text"),
	text: z.string(),
});

export const openDataMcpToolOutputSchema = z.object({
	content: z.array(openDataMcpTextContentSchema),
});

export type OpenDataMcpToolOutput = z.infer<typeof openDataMcpToolOutputSchema>;

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
 * `search_berlin_datasets` renders one markdown block per result with an explicit URL, e.g.:
 *   ## 1. Some Dataset Title
 *   **ID**: some-dataset-id
 *   **URL**: https://daten.berlin.de/datensaetze/some-dataset-id
 *
 * `search_datasets_filtered` omits the URL line; only ID and metadata follow the title.
 */
const SEARCH_RESULT_WITH_URL_PATTERN =
	/##\s*\d+\.\s*(.+?)\n\*\*ID\*\*:\s*(\S+)\n\*\*URL\*\*:\s*(https:\/\/daten\.berlin\.de\/datensaetze\/\S+)/g;

const SEARCH_RESULT_ID_ONLY_PATTERN =
	/##\s*\d+\.\s*(.+?)\n\*\*ID\*\*:\s*(\S+)/g;

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

function extractTextFromMcpOutput(
	output: OpenDataMcpToolOutput,
): string | null {
	const textPart = output.content.find((part) => part.type === "text");

	return textPart?.text ?? null;
}

function extractDatasetIdFromInput(input: OpenDataToolInput): string | null {
	if (!("dataset_id" in input)) {
		return null;
	}

	const { dataset_id: datasetId } = input;
	return datasetId.length > 0 ? datasetId : null;
}

function extractSearchResultSources(text: string): OpenDataCitationSource[] {
	const byUrl = new Map<string, OpenDataCitationSource>();

	for (const match of text.matchAll(SEARCH_RESULT_WITH_URL_PATTERN)) {
		const datasetId = match[2].trim();
		const url = match[3].trim();
		byUrl.set(url, {
			title: match[1].trim(),
			datasetId,
			url,
		});
	}

	for (const match of text.matchAll(SEARCH_RESULT_ID_ONLY_PATTERN)) {
		const datasetId = match[2].trim();
		const url = `${DATASET_URL_PREFIX}${datasetId}`;
		if (byUrl.has(url)) {
			continue;
		}

		byUrl.set(url, {
			title: match[1].trim(),
			datasetId,
			url,
		});
	}

	return [...byUrl.values()];
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
	input: OpenDataToolInput,
	output: OpenDataMcpToolOutput,
): OpenDataCitationSource[] {
	const text = extractTextFromMcpOutput(output);

	const searchMatches = text ? extractSearchResultSources(text) : [];

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
					url: config.openDataMcpUrl,
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
						inputSchema: searchBerlinDatasetsInputSchema,
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
						inputSchema: getDatasetDetailsInputSchema,
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
						inputSchema: fetchDatasetDataInputSchema,
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
						inputSchema: listAllDatasetsInputSchema,
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
						inputSchema: downloadDatasetInputSchema,
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
						inputSchema: getPortalStatsInputSchema,
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
						inputSchema: getFacetsInputSchema,
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
						inputSchema: listTagsInputSchema,
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
						inputSchema: listGeoLayersInputSchema,
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
						inputSchema: fetchGeoFeaturesInputSchema,
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
						inputSchema: aggregateDatasetInputSchema,
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
			if (openDataHttpClient) {
				await openDataHttpClient.close().catch(() => {});
			}
			captureError(error);
			return null;
		}
	};
