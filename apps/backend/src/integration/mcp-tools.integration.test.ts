import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
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
				execute: vi.fn(async () => ({ content: [] })),
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
import { datawrapperMCPTools } from "../tools/mcp/datawrapper-mcp-tools";
import type { DatawrapperMCPToolsResult } from "../tools/mcp/datawrapper-mcp-tools";
import { z } from "zod";

const toolCallOptions = {
	abortSignal: new AbortController().signal,
	toolCallId: "test-call-id",
	messages: [],
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
				mockMcpClient as unknown as ReturnType<
					typeof mcpModule.createMCPClient
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

describe("Datawrapper MCP Tools Integration", () => {
	let mcpResult: DatawrapperMCPToolsResult | null;

	beforeAll(async () => {
		mcpResult = await datawrapperMCPTools();
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

	it("create_visualization should require api_key, data, and chart_type", () => {
		const createTool = mcpResult?.tools["create_visualization"];
		const params = requireZodObjectSchema(createTool, "create_visualization");

		expect(params.shape).toHaveProperty("api_key");
		expect(params.shape).toHaveProperty("data");
		expect(params.shape).toHaveProperty("chart_type");
	});

	it("publish_visualization should require api_key and chart_id", () => {
		const publishTool = mcpResult?.tools["publish_visualization"];
		const params = requireZodObjectSchema(publishTool, "publish_visualization");

		expect(params.shape).toHaveProperty("api_key");
		expect(params.shape).toHaveProperty("chart_id");
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

		const result = await datawrapperMCPTools();
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
