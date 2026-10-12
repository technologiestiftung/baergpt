import {
	describe,
	it,
	expect,
	beforeAll,
	afterAll,
	vi,
	onTestFinished,
} from "vitest";
import type { FlexibleSchema, Tool } from "ai";
import type { JSONObject } from "@ai-sdk/provider";

type MockMCPClientConfig = {
	transport?: { url?: string };
};

type MockMCPToolSchema = {
	inputSchema?: FlexibleSchema<JSONObject>;
	outputSchema?: FlexibleSchema<JSONObject>;
};

type MockMCPTool = {
	description: string;
	execute: ReturnType<typeof vi.fn>;
	inputSchema?: FlexibleSchema<JSONObject>;
};

/**
 * We rewrite some modules so we can mock them
 * in specific test cases if needed.
 */
vi.mock("@ai-sdk/mcp", async () => {
	const createMCPClient = vi.fn(async (config: MockMCPClientConfig) => {
		const url = config?.transport?.url || "";
		const isParla = url.includes("parla");
		const isDatawrapper = url.includes("datawrapper");
		const isOpenData =
			url.includes("open-data") || url.includes("berlin-open-data");

		const mockTools: Record<string, MockMCPTool> = {};

		if (isParla) {
			mockTools["parla_vector_search"] = {
				description: "Vector search tool",
				execute: vi.fn(async () => {
					return {
						documentMatches: [
							{
								registered_document: {
									source_url: "https://example.com/doc.pdf",
									source_type: "PDF",
									metadata: { title: "Test Document" },
								},
								processed_document_chunk_matches: [
									{
										processed_document_chunk: {
											id: 1,
											content: "This is some mock chunk content.",
											page: 2,
										},
									},
								],
							},
						],
					};
				}),
			};
		} else if (isOpenData) {
			mockTools["search_berlin_datasets"] = {
				description: "Search Berlin datasets",
				execute: vi.fn(async () => {
					return {
						content: [
							{
								type: "text",
								text: "# Search Results\n## 1. Fahrradwege in Berlin\n**ID**: fahrradwege-id\n**URL**: https://daten.berlin.de/datensaetze/fahrradwege-id",
							},
						],
					};
				}),
			};
			mockTools["search_datasets_filtered"] = {
				description: "Search datasets with filters",
				execute: vi.fn(async () => {
					return {
						content: [
							{
								type: "text",
								text: '# Filtered Search: "Fahrrad"\n\n## 1. Fahrradwege in Berlin\n**ID**: fahrradwege-id\n**Organization**: SenMVKU',
							},
						],
					};
				}),
			};
			mockTools["get_dataset_details"] = {
				description: "Get dataset details",
				execute: vi.fn(async () => ({ content: [] })),
			};
			mockTools["get_portal_stats"] = {
				description: "Get portal stats",
				execute: vi.fn(async () => {
					return {
						content: [
							{
								type: "text",
								text: "Berlin Open Data Portal Statistics: 5000 datasets.",
							},
						],
					};
				}),
			};
			mockTools["fetch_dataset_data"] = {
				description: "Fetch dataset data",
				execute: vi.fn(async () => ({ content: [] })),
			};
			mockTools["aggregate_dataset"] = {
				description: "Aggregate dataset",
				execute: vi.fn(async () => ({ content: [] })),
			};
		} else if (isDatawrapper) {
			mockTools["create_visualization"] = {
				description: "Create Datawrapper visualization",
				execute: vi.fn(async () => {
					return { chart_id: "mock-chart-id" };
				}),
			};
			mockTools["publish_visualization"] = {
				description: "Publish Datawrapper visualization",
				execute: vi.fn(async () => {
					return { url: "https://datawrapper.dwcdn.net/mock-chart-id" };
				}),
			};
		}

		return {
			tools: vi.fn(
				async (options?: { schemas?: Record<string, MockMCPToolSchema> }) => {
					if (options?.schemas) {
						const schemaTools: Record<string, MockMCPTool> = {};
						for (const [toolName, schema] of Object.entries(options.schemas)) {
							if (mockTools[toolName]) {
								schemaTools[toolName] = {
									...mockTools[toolName],
									...(schema.inputSchema
										? { inputSchema: schema.inputSchema }
										: {}),
								};
							}
						}
						return schemaTools;
					}

					return mockTools;
				},
			),
			close: vi.fn(async () => {}),
		};
	});

	return {
		createMCPClient,
	};
});

vi.mock("../monitoring/capture-error", async () => {
	const actual = await vi.importActual("../monitoring/capture-error");
	return {
		...actual,
	};
});
import * as mcpModule from "@ai-sdk/mcp";
import * as captureErrorModule from "../monitoring/capture-error";

import { parlaMCPTools } from "../tools/mcp/parla-mcp-tools";
import type {
	ParlaMCPToolsResult,
	ParlaResponse,
} from "../tools/mcp/parla-mcp-tools";
import { parseParlaToolOutput } from "../tools/mcp/parla-mcp-tools";
import {
	openDataMCPTools,
	extractOpenDataSourcesFromToolOutput,
	openDataMcpToolOutputSchema,
} from "../tools/mcp/open-data-mcp-tools";
import type { OpenDataMCPToolsResult } from "../tools/mcp/open-data-mcp-tools";
import {
	datawrapperMCPTools,
	DATAWRAPPER_API_KEY_MISSING_SCOPES_MESSAGE,
	INVALID_DATAWRAPPER_API_KEY_MESSAGE,
	MISSING_DATAWRAPPER_API_KEY_MESSAGE,
} from "../tools/mcp/datawrapper-mcp-tools";
import type { DatawrapperMCPToolsResult } from "../tools/mcp/datawrapper-mcp-tools";
import { IntegrationKeysService } from "../services/integration-keys-service";
import { integrationProviders } from "../services/integration-providers";
import { z } from "zod";

const toolCallOptions = {
	abortSignal: new AbortController().signal,
	toolCallId: "test-call-id",
	messages: [],
	context: "",
};

function isZodObjectSchema(
	schema: Tool["inputSchema"],
): schema is z.ZodObject<z.ZodRawShape> {
	return (
		schema !== null &&
		typeof schema === "object" &&
		"shape" in schema &&
		typeof schema.shape === "object"
	);
}

function requireToolExecute(tool: Tool | undefined, toolName: string) {
	expect(tool).toBeDefined();
	expect(tool?.execute).toBeDefined();

	if (!tool?.execute) {
		throw new Error(`${toolName} execute function not found`);
	}

	return { tool, execute: tool.execute };
}

function requireZodObjectSchema(
	tool: Tool | undefined,
	toolName: string,
): z.ZodObject<z.ZodRawShape> {
	expect(tool).toBeDefined();
	expect(tool).toHaveProperty("inputSchema");

	if (!tool) {
		throw new Error(`${toolName} tool not found`);
	}

	if (!isZodObjectSchema(tool.inputSchema)) {
		throw new Error(`${toolName} inputSchema is not a Zod object`);
	}

	return tool.inputSchema;
}

describe("Parla MCP Tools Integration", () => {
	let mcpResult: ParlaMCPToolsResult | null;

	beforeAll(async () => {
		mcpResult = await parlaMCPTools();
	}, 30_000);

	afterAll(async () => {
		if (mcpResult?.cleanup) {
			await mcpResult.cleanup();
		}
	});

	it("should successfully initialize MCP client and return tools", async () => {
		expect(mcpResult).not.toBeNull();
		expect(mcpResult?.tools).toBeDefined();
		expect(typeof mcpResult?.tools).toBe("object");
	});

	it("should include parla_vector_search tool", async () => {
		expect(mcpResult?.tools).toHaveProperty("parla_vector_search");
		const vectorSearchTool = mcpResult?.tools["parla_vector_search"];
		expect(vectorSearchTool).toBeDefined();
		expect(vectorSearchTool?.description).toBeDefined();
	});

	it("parla_vector_search tool should have correct schema properties", async () => {
		const vectorSearchTool = mcpResult?.tools["parla_vector_search"];
		expect(vectorSearchTool).toBeDefined();

		expect(vectorSearchTool).toHaveProperty("description");
		expect(vectorSearchTool).toHaveProperty("inputSchema");
		expect(vectorSearchTool).toHaveProperty("execute");
	});

	it("should handle initialization errors gracefully", async () => {
		const givenError = new Error("MCP server is down");

		const createMCPClientSpy = vi
			.spyOn(mcpModule, "createMCPClient")
			.mockImplementation(() => {
				throw givenError;
			});

		const captureErrorSpy = vi
			.spyOn(captureErrorModule, "captureError")
			.mockImplementationOnce(() => {});

		const result = await parlaMCPTools();
		expect(result).toBeNull();

		expect(captureErrorSpy).toHaveBeenNthCalledWith(1, givenError);

		createMCPClientSpy.mockRestore();
		captureErrorSpy.mockRestore();
	});

	it("parla_vector_search tool should have execute function that can be called", async () => {
		const vectorSearchTool = mcpResult?.tools["parla_vector_search"];
		expect(vectorSearchTool).toBeDefined();

		if (
			vectorSearchTool &&
			"execute" in vectorSearchTool &&
			vectorSearchTool.execute
		) {
			expect(typeof vectorSearchTool.execute).toBe("function");

			const mockParams = {
				query: "test search query",
				match_threshold: 0.7,
				chunk_limit: 5,
			};

			const result = await vectorSearchTool.execute(
				mockParams,
				toolCallOptions,
			);
			expect(result).toBeDefined();
		}
	}, 60_000);

	it("should wrap tools with proper Zod validation for parla_vector_search", async () => {
		const vectorSearchTool = mcpResult?.tools["parla_vector_search"];
		const params = requireZodObjectSchema(
			vectorSearchTool,
			"parla_vector_search",
		);

		expect(params).toBeDefined();
		expect(params.shape).toBeDefined();

		expect(params.shape).toHaveProperty("query");
		expect(params.shape).toHaveProperty("match_threshold");
		expect(params.shape).toHaveProperty("num_probes_chunks");
		expect(params.shape).toHaveProperty("num_probes_summaries");
		expect(params.shape).toHaveProperty("chunk_limit");
		expect(params.shape).toHaveProperty("summary_limit");
		expect(params.shape).toHaveProperty("document_limit");
	});

	it("parla_vector_search execute output should be parseable for citations", async () => {
		const vectorSearchTool = mcpResult?.tools["parla_vector_search"];
		const { execute } = requireToolExecute(
			vectorSearchTool,
			"parla_vector_search",
		);

		const result = await execute(
			{ query: "test search query", chunk_limit: 5 },
			toolCallOptions,
		);

		const chunks = parseParlaToolOutput(result);
		expect(chunks.length).toBeGreaterThan(0);
		expect(chunks[0]).toMatchObject({
			id: expect.any(Number),
			content: expect.any(String),
			page: expect.any(Number),
			url: expect.any(String),
			title: expect.any(String),
			source_type: expect.any(String),
		});
	});

	it("should handle execute errors gracefully and return fallback output", async () => {
		const captureErrorSpy = vi
			.spyOn(captureErrorModule, "captureError")
			.mockImplementationOnce(() => {});

		const mockError = new Error(
			"MCP schema validation failed / response malformed",
		);

		const mockMcpClient = {
			tools: vi.fn().mockResolvedValue({
				parla_vector_search: {
					description: "Vector search tool",
					execute: vi.fn().mockRejectedValue(mockError),
				},
			}),
			close: vi.fn(),
		};

		const createMCPClientSpy = vi
			.spyOn(mcpModule, "createMCPClient")
			.mockResolvedValue(
				mockMcpClient as unknown as Awaited<
					ReturnType<typeof mcpModule.createMCPClient>
				>,
			);

		const testResult = await parlaMCPTools();
		expect(testResult).not.toBeNull();

		const tool = testResult?.tools["parla_vector_search"];
		const executeResult = await tool?.execute?.(
			{ query: "test" },
			toolCallOptions,
		);

		expect(executeResult).toEqual({ documentMatches: [] });
		expect(captureErrorSpy).toHaveBeenCalledWith(mockError);

		const parsedFallback = parseParlaToolOutput(executeResult as ParlaResponse);
		expect(parsedFallback).toEqual([]);

		createMCPClientSpy.mockRestore();
		captureErrorSpy.mockRestore();
	});

	it("cleanup function should be callable multiple times", async () => {
		if (mcpResult?.cleanup) {
			await expect(mcpResult.cleanup()).resolves.not.toThrow();

			// Call again to ensure it's idempotent
			await expect(mcpResult.cleanup()).resolves.not.toThrow();
		}
	});
});

describe("Berlin Open Data MCP Tools Integration", () => {
	let mcpResult: OpenDataMCPToolsResult | null;

	beforeAll(async () => {
		mcpResult = await openDataMCPTools();
	}, 60_000);

	afterAll(async () => {
		if (mcpResult?.cleanup) {
			await mcpResult.cleanup();
		}
	});

	it("should successfully initialize MCP client and return tools", () => {
		expect(mcpResult).not.toBeNull();
		expect(mcpResult?.tools).toBeDefined();
		expect(typeof mcpResult?.tools).toBe("object");
	});

	it("should include expected Berlin Open Data tools", () => {
		const expectedTools = [
			"search_berlin_datasets",
			"search_datasets_filtered",
			"get_dataset_details",
			"get_portal_stats",
			"fetch_dataset_data",
			"aggregate_dataset",
		];

		for (const toolName of expectedTools) {
			expect(mcpResult?.tools).toHaveProperty(toolName);
		}
	});

	it("search_berlin_datasets should have correct Zod schema properties", () => {
		const searchTool = mcpResult?.tools["search_berlin_datasets"];
		const params = requireZodObjectSchema(searchTool, "search_berlin_datasets");

		expect(params.shape).toHaveProperty("query");
		expect(params.shape).toHaveProperty("limit");
		expect(params.shape).toHaveProperty("sort");
	});

	it("get_dataset_details should require dataset_id", () => {
		const detailsTool = mcpResult?.tools["get_dataset_details"];
		const params = requireZodObjectSchema(detailsTool, "get_dataset_details");

		expect(params.shape).toHaveProperty("dataset_id");
	});

	it("search_berlin_datasets execute should return parseable MCP output", async () => {
		const searchTool = mcpResult?.tools["search_berlin_datasets"];
		const { execute } = requireToolExecute(
			searchTool,
			"search_berlin_datasets",
		);

		const result = await execute(
			{ query: "Fahrrad", limit: 1 },
			toolCallOptions,
		);

		const parsedOutput = openDataMcpToolOutputSchema.safeParse(result);
		expect(parsedOutput.success).toBe(true);
		expect(parsedOutput.data?.content[0]?.text).toContain("Search Results");
	}, 60_000);

	it("extractOpenDataSourcesFromToolOutput should parse search results", async () => {
		const searchTool = mcpResult?.tools["search_berlin_datasets"];
		const { execute } = requireToolExecute(
			searchTool,
			"search_berlin_datasets",
		);

		const input = { query: "Fahrrad", limit: 1 };
		const result = await execute(input, toolCallOptions);
		const parsedOutput = openDataMcpToolOutputSchema.parse(result);

		const sources = extractOpenDataSourcesFromToolOutput(input, parsedOutput);

		expect(sources.length).toBeGreaterThan(0);
		expect(sources[0]).toMatchObject({
			url: expect.stringContaining("https://daten.berlin.de/datensaetze/"),
			title: expect.any(String),
			datasetId: expect.any(String),
		});
	}, 60_000);

	it("extractOpenDataSourcesFromToolOutput should parse filtered search results without URLs", async () => {
		const searchTool = mcpResult?.tools["search_datasets_filtered"];
		const { execute } = requireToolExecute(
			searchTool,
			"search_datasets_filtered",
		);

		const input = { query: "Fahrrad", rows: 1 };
		const result = await execute(input, toolCallOptions);
		const parsedOutput = openDataMcpToolOutputSchema.parse(result);

		const sources = extractOpenDataSourcesFromToolOutput(input, parsedOutput);

		expect(sources).toHaveLength(1);
		expect(sources[0]).toMatchObject({
			title: "Fahrradwege in Berlin",
			datasetId: "fahrradwege-id",
			url: "https://daten.berlin.de/datensaetze/fahrradwege-id",
		});
	}, 60_000);

	it("get_portal_stats execute should return portal statistics", async () => {
		const statsTool = mcpResult?.tools["get_portal_stats"];
		const { execute } = requireToolExecute(statsTool, "get_portal_stats");

		const result = await execute({}, toolCallOptions);
		const parsedOutput = openDataMcpToolOutputSchema.safeParse(result);

		expect(parsedOutput.success).toBe(true);
		expect(parsedOutput.data?.content[0]?.text).toContain(
			"Berlin Open Data Portal Statistics",
		);
	}, 60_000);

	it("should handle initialization errors gracefully", async () => {
		const consoleErrorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => {});

		const createMCPClientSpy = vi
			.spyOn(mcpModule, "createMCPClient")
			.mockImplementation(() => {
				throw new Error("Berlin Open Data MCP server is down");
			});

		const result = await openDataMCPTools();
		expect(result).toBeNull();
		expect(consoleErrorSpy).toHaveBeenCalled();

		createMCPClientSpy.mockRestore();
		consoleErrorSpy.mockRestore();
	});

	it("cleanup function should be callable multiple times", async () => {
		if (mcpResult?.cleanup) {
			await expect(mcpResult.cleanup()).resolves.not.toThrow();
			await expect(mcpResult.cleanup()).resolves.not.toThrow();
		}
	});
});

const TEST_DATAWRAPPER_API_KEY = "dw-test-key-1234567890";
const TEST_USER_ID = "88888888-8888-4888-8888-888888888888";

/** Stubs the stored key lookup for the current test only. */
function mockStoredApiKey(apiKey: string | null) {
	const getDecryptedKey = vi
		.spyOn(IntegrationKeysService.prototype, "getDecryptedKey")
		.mockResolvedValue(apiKey);
	onTestFinished(() => getDecryptedKey.mockRestore());
	return getDecryptedKey;
}

/** Stubs the re-check of the stored key after a failed tool call. */
function mockKeyCheck(result: "valid" | "invalid" | "missing_scopes") {
	const checkKeySpy = vi
		.spyOn(integrationProviders.datawrapper, "checkKey")
		.mockResolvedValue(result);
	onTestFinished(() => checkKeySpy.mockRestore());
	return checkKeySpy;
}

/** Raw tools of the most recently created (mocked) MCP client. */
async function getLatestRawMcpTools(): Promise<Record<string, MockMCPTool>> {
	const client = await vi.mocked(mcpModule.createMCPClient).mock.results.at(-1)
		?.value;
	return await client.tools();
}

describe("Datawrapper MCP Tools Integration", () => {
	let mcpResult: DatawrapperMCPToolsResult | null;

	beforeAll(async () => {
		mcpResult = await datawrapperMCPTools(TEST_USER_ID);
	}, 60_000);

	afterAll(async () => {
		if (mcpResult?.cleanup) {
			await mcpResult.cleanup();
		}
	});

	it("should successfully initialize MCP client and return tools", () => {
		expect(mcpResult).not.toBeNull();
		expect(mcpResult?.tools).toBeDefined();
		expect(typeof mcpResult?.tools).toBe("object");
	});

	it("should include create_visualization and publish_visualization tools", () => {
		expect(mcpResult?.tools).toHaveProperty("create_visualization");
		expect(mcpResult?.tools).toHaveProperty("publish_visualization");

		expect(mcpResult?.tools["create_visualization"]?.description).toBeDefined();
		expect(
			mcpResult?.tools["publish_visualization"]?.description,
		).toBeDefined();
	});

	it("create_visualization should require data and chart_type but not expose api_key to the model", () => {
		const createTool = mcpResult?.tools["create_visualization"];
		const params = requireZodObjectSchema(createTool, "create_visualization");

		expect(params.shape).not.toHaveProperty("api_key");
		expect(params.shape).toHaveProperty("data");
		expect(params.shape).toHaveProperty("chart_type");
	});

	it("publish_visualization should require chart_id but not expose api_key to the model", () => {
		const publishTool = mcpResult?.tools["publish_visualization"];
		const params = requireZodObjectSchema(publishTool, "publish_visualization");

		expect(params.shape).not.toHaveProperty("api_key");
		expect(params.shape).toHaveProperty("chart_id");
	});

	it("should add the stored api_key to the MCP call server-side", async () => {
		const getDecryptedKeySpy = mockStoredApiKey(TEST_DATAWRAPPER_API_KEY);
		const result = await datawrapperMCPTools(TEST_USER_ID);
		const rawTools = await getLatestRawMcpTools();
		const { execute } = requireToolExecute(
			result?.tools["publish_visualization"],
			"publish_visualization",
		);

		await execute({ chart_id: "mock-chart-id" }, toolCallOptions);

		expect(getDecryptedKeySpy).toHaveBeenCalledWith(
			TEST_USER_ID,
			"datawrapper",
		);
		expect(rawTools["publish_visualization"].execute).toHaveBeenCalledWith(
			{ chart_id: "mock-chart-id", api_key: TEST_DATAWRAPPER_API_KEY },
			toolCallOptions,
		);
		await result?.cleanup();
	});

	it("should not call the MCP server and tell the model where to add the key when none is stored", async () => {
		mockStoredApiKey(null);
		const result = await datawrapperMCPTools(TEST_USER_ID);
		const rawTools = await getLatestRawMcpTools();
		const { execute } = requireToolExecute(
			result?.tools["create_visualization"],
			"create_visualization",
		);

		const output = await execute(
			{ data: [{ a: 1 }], chart_type: "bar" },
			toolCallOptions,
		);

		expect(output).toEqual({ error: MISSING_DATAWRAPPER_API_KEY_MESSAGE });
		expect(rawTools["create_visualization"].execute).not.toHaveBeenCalled();
		await result?.cleanup();
	});

	it("should not call the MCP server when the stored key can't be decrypted", async () => {
		const getDecryptedKeySpy = vi
			.spyOn(IntegrationKeysService.prototype, "getDecryptedKey")
			.mockRejectedValue(
				new Error("Unsupported state or unable to authenticate data"),
			);
		onTestFinished(() => getDecryptedKeySpy.mockRestore());
		const result = await datawrapperMCPTools(TEST_USER_ID);
		const rawTools = await getLatestRawMcpTools();
		const { execute } = requireToolExecute(
			result?.tools["publish_visualization"],
			"publish_visualization",
		);

		await expect(
			execute({ chart_id: "mock-chart-id" }, toolCallOptions),
		).rejects.toThrow("unable to authenticate data");
		expect(rawTools["publish_visualization"].execute).not.toHaveBeenCalled();
		await result?.cleanup();
	});

	it.each([
		["invalid", INVALID_DATAWRAPPER_API_KEY_MESSAGE],
		["missing_scopes", DATAWRAPPER_API_KEY_MISSING_SCOPES_MESSAGE],
	] as const)(
		"should explain a key that became %s after a failed call",
		async (keyCheckResult, expectedMessage) => {
			mockStoredApiKey(TEST_DATAWRAPPER_API_KEY);
			const checkKeySpy = mockKeyCheck(keyCheckResult);
			const result = await datawrapperMCPTools(TEST_USER_ID);
			const rawTools = await getLatestRawMcpTools();
			rawTools["publish_visualization"].execute.mockRejectedValueOnce(
				new Error("Datawrapper API error 403"),
			);
			const { execute } = requireToolExecute(
				result?.tools["publish_visualization"],
				"publish_visualization",
			);

			const output = await execute(
				{ chart_id: "mock-chart-id" },
				toolCallOptions,
			);

			expect(checkKeySpy).toHaveBeenCalledWith(TEST_DATAWRAPPER_API_KEY);
			expect(output).toEqual({ error: expectedMessage });
			await result?.cleanup();
		},
	);

	it("should also re-check the key when the MCP server returns an error result", async () => {
		mockStoredApiKey(TEST_DATAWRAPPER_API_KEY);
		mockKeyCheck("missing_scopes");
		const result = await datawrapperMCPTools(TEST_USER_ID);
		const rawTools = await getLatestRawMcpTools();
		rawTools["publish_visualization"].execute.mockResolvedValueOnce({
			isError: true,
			content: [{ type: "text", text: "Forbidden" }],
		});
		const { execute } = requireToolExecute(
			result?.tools["publish_visualization"],
			"publish_visualization",
		);

		const output = await execute(
			{ chart_id: "mock-chart-id" },
			toolCallOptions,
		);

		expect(output).toEqual({
			error: DATAWRAPPER_API_KEY_MISSING_SCOPES_MESSAGE,
		});
		await result?.cleanup();
	});

	it("should pass the original error result through when the key is fine", async () => {
		mockStoredApiKey(TEST_DATAWRAPPER_API_KEY);
		mockKeyCheck("valid");
		const errorResult = {
			isError: true,
			content: [{ type: "text", text: "Invalid data" }],
		};
		const result = await datawrapperMCPTools(TEST_USER_ID);
		const rawTools = await getLatestRawMcpTools();
		rawTools["publish_visualization"].execute.mockResolvedValueOnce(
			errorResult,
		);
		const { execute } = requireToolExecute(
			result?.tools["publish_visualization"],
			"publish_visualization",
		);

		const output = await execute(
			{ chart_id: "mock-chart-id" },
			toolCallOptions,
		);

		expect(output).toEqual(errorResult);
		await result?.cleanup();
	});

	it("should keep the original error when the key re-check itself fails", async () => {
		mockStoredApiKey(TEST_DATAWRAPPER_API_KEY);
		const checkKeySpy = vi
			.spyOn(integrationProviders.datawrapper, "checkKey")
			.mockRejectedValue(new Error("Datawrapper key check returned 503"));
		onTestFinished(() => checkKeySpy.mockRestore());
		const result = await datawrapperMCPTools(TEST_USER_ID);
		const rawTools = await getLatestRawMcpTools();
		rawTools["publish_visualization"].execute.mockRejectedValueOnce(
			new Error("MCP server error"),
		);
		const { execute } = requireToolExecute(
			result?.tools["publish_visualization"],
			"publish_visualization",
		);

		await expect(
			execute({ chart_id: "mock-chart-id" }, toolCallOptions),
		).rejects.toThrow("MCP server error");
		await result?.cleanup();
	});

	it("should redact the api_key from MCP results", async () => {
		mockStoredApiKey(TEST_DATAWRAPPER_API_KEY);
		const result = await datawrapperMCPTools(TEST_USER_ID);
		const rawTools = await getLatestRawMcpTools();
		rawTools["publish_visualization"].execute.mockResolvedValueOnce({
			content: [
				{
					type: "text",
					text: `Published with key ${TEST_DATAWRAPPER_API_KEY}`,
				},
			],
		});
		const { execute } = requireToolExecute(
			result?.tools["publish_visualization"],
			"publish_visualization",
		);

		const output = await execute(
			{ chart_id: "mock-chart-id" },
			toolCallOptions,
		);

		expect(output).toEqual({
			content: [{ type: "text", text: "Published with key [REDACTED]" }],
		});
		await result?.cleanup();
	});

	it("should redact the api_key from MCP error messages", async () => {
		mockStoredApiKey(TEST_DATAWRAPPER_API_KEY);
		mockKeyCheck("valid");
		const result = await datawrapperMCPTools(TEST_USER_ID);
		const rawTools = await getLatestRawMcpTools();
		rawTools["publish_visualization"].execute.mockRejectedValueOnce(
			new Error(`Invalid token ${TEST_DATAWRAPPER_API_KEY}`),
		);
		const { execute } = requireToolExecute(
			result?.tools["publish_visualization"],
			"publish_visualization",
		);

		const call = execute({ chart_id: "mock-chart-id" }, toolCallOptions);

		await expect(call).rejects.toThrow("Invalid token [REDACTED]");
		await expect(call).rejects.not.toThrow(TEST_DATAWRAPPER_API_KEY);
		await result?.cleanup();
	});

	it("should handle initialization errors gracefully", async () => {
		const consoleErrorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => {});

		const createMCPClientSpy = vi
			.spyOn(mcpModule, "createMCPClient")
			.mockImplementation(() => {
				throw new Error("Datawrapper MCP server is down");
			});

		const result = await datawrapperMCPTools(TEST_USER_ID);
		expect(result).toBeNull();
		expect(consoleErrorSpy).toHaveBeenCalled();

		createMCPClientSpy.mockRestore();
		consoleErrorSpy.mockRestore();
	});

	it("cleanup function should be callable multiple times", async () => {
		if (mcpResult?.cleanup) {
			await expect(mcpResult.cleanup()).resolves.not.toThrow();
			await expect(mcpResult.cleanup()).resolves.not.toThrow();
		}
	});
});
