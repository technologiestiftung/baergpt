import { createMCPClient, MCPClient } from "@ai-sdk/mcp";
import { asSchema, jsonSchema, tool, type JSONSchema7, type Tool } from "ai";
import { z } from "zod";
import { config } from "../../config";
import { captureError } from "../../monitoring/capture-error";
import { serviceRoleDbClient } from "../../supabase";
import { IntegrationKeysService } from "../../services/integration-keys-service";
import { integrationProviders } from "../../services/integration-providers";

export interface DatawrapperMCPToolsResult {
	tools: Record<string, Tool>;
	cleanup: () => Promise<void>;
}

export const MISSING_DATAWRAPPER_API_KEY_MESSAGE =
	"Für die nutzende Person ist kein Datawrapper-API-Token gespeichert. Frage im Chat nicht nach dem Token. Weise darauf hin, dass sich ein Datawrapper-API-Token auf der Profilseite hinterlegen lässt, und bitte darum, es danach erneut zu versuchen.";

export const INVALID_DATAWRAPPER_API_KEY_MESSAGE =
	"Der gespeicherte Datawrapper-API-Token ist ungültig oder wurde widerrufen. Frage im Chat nicht nach dem Token. Weise darauf hin, dass sich auf der Profilseite ein neuer Token hinterlegen lässt.";

export const DATAWRAPPER_API_KEY_MISSING_SCOPES_MESSAGE = `Dem gespeicherten Datawrapper-API-Token fehlen Berechtigungen. Benötigt werden: ${integrationProviders.datawrapper.requiredScopes.join(", ")}. Frage im Chat nicht nach dem Token. Weise darauf hin, dass die Berechtigungen des Tokens erweitert werden können oder sich auf der Profilseite ein neuer Token mit diesen Berechtigungen hinterlegen lässt.`;

// todo: change the datawrapper mcp prompt in langfuse

const isErrorResult = (result: unknown) =>
	typeof result === "object" &&
	result !== null &&
	"isError" in result &&
	result.isError === true;

export const isDatawrapperToolFailure = (result: unknown): boolean =>
	isErrorResult(result) ||
	(typeof result === "object" &&
		result !== null &&
		"error" in result &&
		typeof (result as { error: unknown }).error === "string");

/**
 * After a failed tool call, re-checks the stored key, since it may have been
 * revoked or lost scopes since it was saved. Returns a message for the model
 * if the key is the problem, null otherwise (or if the check itself fails).
 */
async function diagnoseApiKey(apiKey: string): Promise<string | null> {
	const result = await integrationProviders.datawrapper
		.checkKey(apiKey)
		.catch(() => "valid");

	if (result === "invalid") {
		return INVALID_DATAWRAPPER_API_KEY_MESSAGE;
	}
	if (result === "missing_scopes") {
		return DATAWRAPPER_API_KEY_MISSING_SCOPES_MESSAGE;
	}
	return null;
}

/**
 * Our MCP server could echo the key back, e.g. in a validation error that
 * dumps the request parameters. Results reach the model, chat history and
 * traces, so the key must never be part of them.
 */
function redactApiKey<T>(value: T, apiKey: string): T {
	const serialized = JSON.stringify(value);
	return serialized?.includes(apiKey)
		? JSON.parse(serialized.replaceAll(apiKey, "[REDACTED]"))
		: value;
}

/**
 * Adds the user's stored API key to the MCP call on the server, so the key
 * never appears in the model's tool schema, tool-call arguments, chat history
 * or traces.
 */
async function executeWithApiKey({
	userId,
	mcpTool,
	params,
	options,
}: {
	userId: string;
	mcpTool: Tool;
	params: Record<string, unknown>;
	options: Parameters<NonNullable<Tool["execute"]>>[1];
}) {
	let apiKey: string | null;
	try {
		apiKey = await new IntegrationKeysService(
			serviceRoleDbClient,
		).getDecryptedKey(userId, "datawrapper");
	} catch (error) {
		// e.g. undecryptable after an encryption key change: saving the key again fixes it
		captureError(error);
		return { error: MISSING_DATAWRAPPER_API_KEY_MESSAGE };
	}

	if (!apiKey) {
		return { error: MISSING_DATAWRAPPER_API_KEY_MESSAGE };
	}

	if (!mcpTool.execute) {
		throw new Error("MCP tool execute function not found");
	}

	try {
		const result = await mcpTool.execute(
			{ ...params, api_key: apiKey },
			options,
		);
		if (isErrorResult(result)) {
			const keyProblem = await diagnoseApiKey(apiKey);
			return keyProblem ? { error: keyProblem } : redactApiKey(result, apiKey);
		}
		return redactApiKey(result, apiKey);
	} catch (error) {
		const keyProblem = await diagnoseApiKey(apiKey);
		if (keyProblem) {
			return { error: keyProblem };
		}

		if (error instanceof Error && error.message.includes(apiKey)) {
			throw new Error(error.message.replaceAll(apiKey, "[REDACTED]"));
		}
		throw error;
	}
}

/**
 * Permanently deletes charts in the user's account. Not offered, so content
 * from web search, RAG or Open Data can't trick the model into deleting them.
 */
const EXCLUDED_TOOL_NAMES = new Set(["delete_visualization"]);

/**
 * Every Datawrapper MCP tool takes the key as `api_key`. It is removed from the
 * schema the model sees; executeWithApiKey adds it back on the server.
 */
async function withoutApiKeyParam(inputSchema: Tool["inputSchema"]) {
	const {
		properties = {},
		required = [],
		...schema
	} = (await asSchema(inputSchema).jsonSchema) as JSONSchema7;
	const { api_key: _apiKey, ...otherProperties } = properties;
	return jsonSchema({
		...schema,
		properties: otherProperties,
		required: required.filter((name) => name !== "api_key"),
	});
}

export const datawrapperMCPTools = async (
	userId: string,
): Promise<DatawrapperMCPToolsResult | null> => {
	let datawrapperHttpClient: MCPClient | undefined;
	try {
		datawrapperHttpClient = await createMCPClient({
			transport: {
				type: "http",
				url: config.datawrapperMcpUrl,
			},
		});

		const datawrapperHttpClientToolSet = await datawrapperHttpClient.tools();

		// Wrap MCP tools with proper Zod validation
		// The MCP SDK returns tools with JSON Schema, but the AI SDK needs proper Zod schemas
		const wrappedTools: Record<string, Tool> = {};

		for (const [toolName, mcpTool] of Object.entries(
			datawrapperHttpClientToolSet,
		)) {
			if (EXCLUDED_TOOL_NAMES.has(toolName)) {
				continue;
			}

			if (toolName === "create_visualization") {
				wrappedTools[toolName] = tool({
					description:
						mcpTool.description ||
						"Create a Datawrapper visualization (not published)",
					inputSchema: z
						.object({
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
								.describe(
									"Type of visualization to create. Scatter/range/arrow require 2+ numeric columns. Map requires map_type.",
								),
							variant: z
								.enum(["basic", "stacked", "grouped", "split"])
								.optional()
								.describe(
									"Chart variant. For bar: basic, stacked, split. For column: basic, grouped, stacked.",
								),
							map_type: z
								.enum(["d3-maps-symbols", "d3-maps-choropleth"])
								.optional()
								.describe(
									"Required when chart_type is 'map'. 'd3-maps-symbols' for point locations (GeoJSON), 'd3-maps-choropleth' for region comparisons.",
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
							base_color: z
								.string()
								.optional()
								.describe('Base color for the chart, e.g. "#E63946".'),
							thick: z
								.boolean()
								.optional()
								.describe("Thickness toggle for supported chart types."),
							value_label_format: z
								.string()
								.optional()
								.describe(
									'Number format for value labels, e.g. "0,0.[00]" or "0.0%".',
								),
							visualize_overrides: z
								.record(z.string(), z.unknown())
								.optional()
								.describe(
									"Advanced Datawrapper visualize metadata overrides. Use for styling beyond base_color.",
								),
							title: z.string().optional().describe("Chart title"),
							description: z
								.string()
								.optional()
								.describe("Chart description/byline"),
							source_dataset_id: z
								.string()
								.optional()
								.describe("Berlin dataset ID for tracking"),
						})
						.superRefine((data, ctx) => {
							if (data.chart_type === "map" && !data.map_type) {
								ctx.addIssue({
									code: "custom",
									message: "map_type is required when chart_type is 'map'",
									path: ["map_type"],
								});
							}
						}),
					execute: (params, options) =>
						executeWithApiKey({ userId, mcpTool, params, options }),
				});
			} else if (toolName === "publish_visualization") {
				wrappedTools[toolName] = tool({
					description:
						mcpTool.description || "Publish a Datawrapper visualization",
					inputSchema: z.object({
						chart_id: z
							.string()
							.min(1, "Chart ID is required")
							.describe("The chart ID returned from create_visualization"),
					}),
					execute: (params, options) =>
						executeWithApiKey({ userId, mcpTool, params, options }),
				});
			} else {
				wrappedTools[toolName] = tool({
					description: mcpTool.description,
					inputSchema: await withoutApiKeyParam(mcpTool.inputSchema),
					execute: (params, options) =>
						executeWithApiKey({
							userId,
							mcpTool,
							params: params as Record<string, unknown>,
							options,
						}),
				});
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
		if (datawrapperHttpClient) {
			await datawrapperHttpClient.close().catch(() => {});
		}
		captureError(error);
		return null;
	}
};

const DATAWRAPPER_CHART_URL =
	/https:\/\/datawrapper\.dwcdn\.net\/([A-Za-z0-9_-]{5})\//g;

const MAX_VERIFIED_CHART_IDS = 10;

const CHART_CHECK_TIMEOUT_MS = 5_000;

async function isOwnPublishedChart(
	chartId: string,
	apiKey: string,
): Promise<boolean> {
	const response = await fetch(
		`https://api.datawrapper.de/v3/charts/${chartId}`,
		{
			headers: { Authorization: `Bearer ${apiKey}` },
			signal: AbortSignal.timeout(CHART_CHECK_TIMEOUT_MS),
		},
	);
	if (!response.ok) {
		return false;
	}
	const chart = (await response.json()) as { publicVersion?: number };
	return (chart.publicVersion ?? 0) > 0;
}

/**
 * Chart ids the frontend may embed: charts published in this answer, plus
 * linked charts the Datawrapper API confirms are published in the user's own
 * account. Links to anyone else's charts stay plain links.
 */
export async function getEmbeddableDatawrapperChartIds({
	userId,
	text,
	toolResults,
}: {
	userId: string;
	text: string;
	toolResults: { toolName: string; input: unknown; output: unknown }[];
}): Promise<string[]> {
	const publishedChartIds = new Set(
		toolResults
			.filter(
				(toolResult) =>
					toolResult.toolName === "publish_visualization" &&
					!isDatawrapperToolFailure(toolResult.output),
			)
			.map((toolResult) => (toolResult.input as { chart_id?: string }).chart_id)
			.filter((id): id is string => Boolean(id)),
	);

	const linkedChartIds = Array.from(
		new Set(Array.from(text.matchAll(DATAWRAPPER_CHART_URL), ([, id]) => id)),
	)
		.filter((id) => !publishedChartIds.has(id))
		.slice(0, MAX_VERIFIED_CHART_IDS);

	if (linkedChartIds.length === 0) {
		return Array.from(publishedChartIds);
	}

	let apiKey: string | null;
	try {
		apiKey = await new IntegrationKeysService(
			serviceRoleDbClient,
		).getDecryptedKey(userId, "datawrapper");
	} catch (error) {
		captureError(error);
		return Array.from(publishedChartIds);
	}

	if (!apiKey) {
		return Array.from(publishedChartIds);
	}

	const checks = await Promise.allSettled(
		linkedChartIds.map((id) => isOwnPublishedChart(id, apiKey)),
	);
	const ownChartIds = linkedChartIds.filter((_, index) => {
		const check = checks[index];
		return check.status === "fulfilled" && check.value;
	});

	return [...publishedChartIds, ...ownChartIds];
}
