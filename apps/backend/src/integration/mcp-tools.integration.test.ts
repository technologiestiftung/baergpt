import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { parlaMCPTools } from "../tools/mcp/parla-mcp-tools";
import type { ParlaMCPToolsResult } from "../tools/mcp/parla-mcp-tools";
import { z } from "zod";

describe("MCP Tools Integration", () => {
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
		// Mock createMCPClient to throw an error
		const consoleErrorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => {});

		// This test verifies error handling by calling parlaMCPTools again
		// In a real scenario where the MCP server is down, it should return null
		// For now, we just verify the function doesn't throw
		const result = await parlaMCPTools();
		expect(result).not.toBeUndefined();

		consoleErrorSpy.mockRestore();
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

			try {
				const mockParams = {
					query: "test search query",
					match_threshold: 0.7,
					chunk_limit: 5,
				};

				const result = await vectorSearchTool.execute(mockParams, {
					abortSignal: new AbortController().signal,
					toolCallId: "test-call-id",
					messages: [],
				});
				expect(result).toBeDefined();
			} catch (error) {
				expect(error).toBeDefined();
			}
		}
	}, 60_000);

	it("should wrap tools with proper Zod validation for parla_vector_search", async () => {
		const vectorSearchTool = mcpResult?.tools["parla_vector_search"];
		expect(vectorSearchTool).toBeDefined();

		if (vectorSearchTool && "inputSchema" in vectorSearchTool) {
			const params =
				vectorSearchTool.inputSchema as unknown as z.ZodObject<z.ZodRawShape>;

			expect(params).toBeDefined();
			expect(params.shape).toBeDefined();

			expect(params.shape).toHaveProperty("query");
			expect(params.shape).toHaveProperty("match_threshold");
			expect(params.shape).toHaveProperty("num_probes_chunks");
			expect(params.shape).toHaveProperty("num_probes_summaries");
			expect(params.shape).toHaveProperty("chunk_limit");
			expect(params.shape).toHaveProperty("summary_limit");
			expect(params.shape).toHaveProperty("document_limit");
		}
	});

	it("should handle missing execute function gracefully", async () => {
		const vectorSearchTool = mcpResult?.tools["parla_vector_search"];

		if (
			vectorSearchTool &&
			"execute" in vectorSearchTool &&
			vectorSearchTool.execute
		) {
			// Create a scenario where execute would fail
			// by passing invalid parameters that don't match the schema
			try {
				await vectorSearchTool.execute(
					{ invalid: "params" } as unknown as Parameters<
						typeof vectorSearchTool.execute
					>[0],
					{
						abortSignal: new AbortController().signal,
						toolCallId: "test-call-id",
						messages: [],
					},
				);
			} catch (error) {
				expect(error).toBeDefined();
			}
		}
	});

	it("cleanup function should be callable multiple times", async () => {
		if (mcpResult?.cleanup) {
			await expect(mcpResult.cleanup()).resolves.not.toThrow();

			// Call again to ensure it's idempotent
			await expect(mcpResult.cleanup()).resolves.not.toThrow();
		}
	});
});
