import crypto from "crypto";
import { enc } from "../constants";
import { config } from "../config";
import { isLoopFinished, ModelMessage, Tool, ToolChoice } from "ai";
import {
	createUIMessageStream,
	createUIMessageStreamResponse,
	generateText,
	Output,
	streamText,
} from "ai";
import { ModelService } from "./model-service";
import { logMemory } from "../monitoring/memory-logger";
import { EmbeddingService } from "./embedding-service";
import type { ChatPromptClient, TextPromptClient } from "@langfuse/client";
import { updateActiveTrace } from "@langfuse/tracing";
import { getChatPrompt, getTextPrompt } from "./prompt-provider";
import { type Document, type LLMHandler } from "../types/common";
import { BaseContentDbService } from "./db-service/base-db-service";
import { LLM_PARAMETERS } from "../constants";
import type { ActiveTools, ParsedPage } from "../types/common";
import { ragSearchTool } from "../tools/rag-search-tool";
import {
	parlaMCPTools,
	parseParlaToolOutput,
	type ParlaChunkData,
} from "../tools/mcp/parla-mcp-tools";
import { webSearchTool } from "../tools/web-search";
import { captureError } from "../monitoring/capture-error";
import {
	citationAnswerSchema,
	webCitationAnswerSchema,
	parlaCitationAnswerSchema,
} from "../schemas/citation-answer-schema";
import {
	countTokens,
	computeSafePayload,
	trimToTokenLimitByWords,
} from "./token-utils";
import type { WebSearchResult } from "../tools/web-search";

const modelService = new ModelService();

/**
 * Langfuse currently does not support conditional sections in prompts.
 * So we wrap a user's personal system prompt with the preamble that instructs the
 * model how to treat it. Returns an empty string when there is no prompt.
 */
export function buildUserSystemPromptBlock(
	userSystemPrompt: string | null | undefined,
): string {
	if (!userSystemPrompt) {
		return "";
	}

	const preamble = [
		"# NUTZER ANWEISUNGEN",
		"",
		"Die nutzende Person hat folgende benutzerdefinierte Anweisungen angegeben.",
		"Befolge diese, sofern sie nicht im Widerspruch zu den obigen Anweisungen stehen:",
	].join("\n");

	return `\n\n${preamble}\n\n${userSystemPrompt}`;
}

type RelevantTools = {
	tools: Record<string, Tool>;
	toolChoice: ToolChoice<Record<string, Tool>>;
	cleanup?: () => Promise<void>;
};

/**
 * The base `free-chat-basic` prompt exposes a `{{toolInstructions}}`
 * variable, into which we inject one instruction block per active tool.
 */
const TOOL_INSTRUCTION_PROMPTS: ReadonlyArray<[ActiveTools, string]> = [
	["ragSearchTool", "tool-instruction-documents"],
	["webSearchTool", "tool-instruction-web-search"],
	["parlaMCPTools", "tool-instruction-parla"],
];

export class GenerationService {
	private readonly dbService: BaseContentDbService;
	private readonly embeddingService: EmbeddingService;

	constructor(dbService: BaseContentDbService) {
		this.dbService = dbService;
		this.embeddingService = new EmbeddingService(this.dbService);
	}

	/**
	 * Estimate system prompt token count for a given prompt name by compiling with empty content.
	 */
	private async estimateSystemPromptTokens(
		promptName: string,
	): Promise<number> {
		try {
			const client = await getChatPrompt(promptName, {
				label: config.nodeEnv === "test" ? "development" : config.nodeEnv,
			});

			const compiled = client.compile({ docContent: "" }) as ModelMessage[];
			const sys =
				typeof compiled[0].content === "string"
					? compiled[0].content
					: JSON.stringify(compiled[0].content);
			return enc.encode(sys).length;
		} catch {
			return 0;
		}
	}

	async generateSummary(args: {
		llmIdentifier: string;
		input: string;
		userId: string;
	}): Promise<string> {
		const { llmIdentifier, input, userId } = args;

		const llmHandler = modelService.resolveLlmHandler(llmIdentifier);

		const summaryPromptClient = await getChatPrompt("summary", {
			label: config.nodeEnv === "test" ? "development" : config.nodeEnv,
		});

		const compiledSummaryPrompt = summaryPromptClient.compile({
			docContent: input,
		}) as ModelMessage[];

		return this.generateTextContent({
			llmHandler,
			messages: compiledSummaryPrompt,
			userId,
			langfusePrompt: summaryPromptClient,
		});
	}

	async generateOneSentenceSummary(args: {
		llmIdentifier: string;
		input: string;
		userId: string;
	}): Promise<string> {
		const { llmIdentifier, input, userId } = args;

		const llmHandler = modelService.resolveLlmHandler(llmIdentifier);

		const summaryPromptClient = await getChatPrompt("one-sentence-summary", {
			label: config.nodeEnv === "test" ? "development" : config.nodeEnv,
		});

		const compiledSummaryPrompt = summaryPromptClient.compile({
			docContent: input,
		}) as ModelMessage[];

		return this.generateTextContent({
			llmHandler,
			messages: compiledSummaryPrompt,
			userId,
			langfusePrompt: summaryPromptClient,
		});
	}

	async generateTags(args: {
		llmIdentifier: string;
		input: string | ParsedPage[];
		userId: string;
	}): Promise<string[]> {
		const { llmIdentifier, input, userId } = args;

		const llmHandler = modelService.resolveLlmHandler(llmIdentifier);
		const docContent =
			typeof input === "string"
				? input
				: input.map((page) => page.content).join("\n");

		const taggingPromptClient = await getChatPrompt("tagging", {
			label: config.nodeEnv === "test" ? "development" : config.nodeEnv,
		});
		const compiledTaggingPrompt = taggingPromptClient.compile({
			docContent: docContent,
		}) as ModelMessage[];

		const response: string = await this.generateTextContent({
			llmHandler,
			messages: compiledTaggingPrompt,
			userId,
			langfusePrompt: taggingPromptClient,
		});
		// Extract JSON from potential code block artifacts
		const jsonMatch = response.match(
			/```(?:json)?\s*(\{.*?\})\s*```|(\{.*?\})/s,
		);
		const jsonString = jsonMatch ? jsonMatch[1] || jsonMatch[2] : response;
		const parsed = JSON.parse(jsonString.trim());

		if (!parsed.tags || !Array.isArray(parsed.tags)) {
			throw new Error(
				`Tags were invalid or not found in the LLM response: ${parsed}`,
			);
		}

		return parsed.tags;
	}

	async summarize(
		parsedPages: ParsedPage[],
		llmIdentifier: string,
		document: Document,
	): Promise<{
		summary: string;
		shortSummary: string;
		tags: string[];
	}> {
		const summaryInput = await this.getSummaryInput(parsedPages, llmIdentifier);

		const userId = document.owned_by_user_id || document.uploaded_by_user_id;

		const summary = await this.generateSummary({
			llmIdentifier,
			input: summaryInput,
			userId,
		});

		const shortSummary = await this.generateOneSentenceSummary({
			llmIdentifier,
			input: summaryInput,
			userId,
		});

		const tags = await this.generateTags({
			llmIdentifier,
			input: summary,
			userId,
		});

		return {
			summary,
			shortSummary,
			tags,
		};
	}

	async getSummaryInput(
		parsedPages: ParsedPage[],
		llmIdentifier: string,
	): Promise<string> {
		const { contextSize } = modelService.availableModels[llmIdentifier];
		const systemPromptToken = await this.estimateSystemPromptTokens("summary");
		const tokenLimit = computeSafePayload(contextSize, systemPromptToken);

		const [firstPage] = parsedPages;

		if (firstPage.tokenCount > tokenLimit) {
			return trimToTokenLimitByWords(firstPage.content, tokenLimit);
		}

		const content = parsedPages.map((page) => page.content).join("\n");
		const tokenCount = countTokens(content);

		if (tokenCount <= tokenLimit) {
			return content;
		}

		return trimToTokenLimitByWords(content, tokenLimit);
	}

	async generateTextStreamResponse(args: {
		messages: ModelMessage[];
		llmHandler: LLMHandler;
		userId: string;
		sessionId: string;
		langfusePrompt: TextPromptClient | ChatPromptClient;
		allowedDocumentIds: number[];
		allowedFolderIds: number[];
		activeTools: ActiveTools[];
	}): Promise<Response> {
		const {
			messages,
			llmHandler,
			userId,
			sessionId,
			langfusePrompt,
			allowedDocumentIds,
			allowedFolderIds,
			activeTools,
		} = args;

		const memoryLogId =
			config.nodeEnv === "production"
				? crypto.randomUUID().slice(0, 8)
				: sessionId;
		logMemory("chat:start", memoryLogId);

		const {
			tools,
			toolChoice,
			cleanup: toolsCleanup,
		} = await this.getRelevantTools({
			allowedDocumentIds,
			allowedFolderIds,
			activeTools,
			userId,
		});

		const nonEmptyAssistantMessage = (message: ModelMessage) =>
			!(message.role === "assistant" && message.content === "");

		const stream = createUIMessageStream({
			execute: async ({ writer }) => {
				const streamResponse = streamText({
					model: llmHandler.languageModel,
					messages: messages.filter(nonEmptyAssistantMessage),
					maxOutputTokens: 8192,
					temperature: LLM_PARAMETERS.temperature,
					tools,
					toolChoice,
					stopWhen: isLoopFinished(),
					providerOptions: {
						mistral: {
							presencePenalty: LLM_PARAMETERS.presencePenalty,
							frequencyPenalty: LLM_PARAMETERS.frequencyPenalty,
						},
					},
					onFinish: async ({ text, usage, steps }) => {
						logMemory(
							`chat:onFinish (textLen=${text.length}, tokens=${usage?.totalTokens ?? 0})`,
							memoryLogId,
						);

						if (typeof toolsCleanup === "function") {
							await toolsCleanup();
						}

						const allChunkMatches = steps.flatMap((step) =>
							step.toolResults.flatMap((tr) => tr.output?.chunkMatches || []),
						);

						if (allChunkMatches.length > 0) {
							const availableSources = allChunkMatches.map(
								(match: { chunkId: number; snippet: string }) => ({
									id: match.chunkId,
									snippet: match.snippet,
								}),
							);
							try {
								const citationPromptClient = await getChatPrompt(
									"document-citation-extraction",
									{
										label:
											config.nodeEnv === "test"
												? "development"
												: config.nodeEnv,
									},
								);

								const compiledDocumentCitationExtractionPrompts =
									citationPromptClient.compile({
										generatedAnswer: text,
										availableSources: availableSources
											.map((s) => `[ID: ${s.id}]\n Snippet: ${s.snippet}`)
											.join("\n\n"),
									}) as ModelMessage[];

								const { output: citationObject, usage: generateObjectUsage } =
									await generateText({
										model: llmHandler.languageModel,
										messages: compiledDocumentCitationExtractionPrompts,
										temperature: LLM_PARAMETERS.temperature,
										output: Output.object({
											schema: citationAnswerSchema,
										}),
										experimental_telemetry: {
											isEnabled: config.isTracingEnabled,
											functionId: "citation-extraction",
											metadata: {
												sessionId: sessionId ? sessionId : "unknown",
											},
										},
									});

								writer.write({
									type: "data-citations",
									data: citationObject.citations,
								});

								await this.dbService.updateUsage(
									userId,
									generateObjectUsage.totalTokens,
								);
							} catch (error) {
								captureError(error);
							}
						}

						const allWebSources = steps.flatMap((step) =>
							step.toolResults.flatMap((tr) => {
								const generic = tr.output?.grounding
									?.generic as WebSearchResult["grounding"]["generic"];
								const sources = tr.output
									?.sources as WebSearchResult["sources"];
								if (!generic?.length || !sources) {
									return [];
								}
								return (
									generic
										// Filter out items with no snippets
										.filter(
											(item) =>
												item.snippets.find(
													(s): s is string => typeof s === "string",
												) !== undefined,
										)
										.map((item) => ({
											url: item.url,
											title: item.title,
											snippet: item.snippets.find(
												(s): s is string => typeof s === "string",
											) as string,
											age: sources[item.url]?.age,
										}))
								);
							}),
						);

						if (allWebSources.length > 0) {
							try {
								const webCitationPromptClient = await getChatPrompt(
									"web-citation-extraction",
									{
										label:
											config.nodeEnv === "test"
												? "development"
												: config.nodeEnv,
									},
								);

								const compiledWebCitationExtractionPrompts =
									webCitationPromptClient.compile({
										generatedAnswer: text,
										availableSources: allWebSources
											.map(
												(s) =>
													`[URL: ${s.url}]\n Snippet: ${s.snippet}\n Titel: ${s.title}`,
											)
											.join("\n\n"),
									}) as ModelMessage[];

								const { output: webObject, usage: webCitationUsage } =
									await generateText({
										model: llmHandler.languageModel,
										messages: compiledWebCitationExtractionPrompts,
										temperature: LLM_PARAMETERS.temperature,
										output: Output.object({
											schema: webCitationAnswerSchema,
										}),
										experimental_telemetry: {
											isEnabled: config.isTracingEnabled,
											functionId: "web-citation-extraction",
											metadata: {
												sessionId: sessionId ? sessionId : "unknown",
											},
										},
									});

								const citedSources = allWebSources.filter((s) =>
									webObject.citations.some((c) => c.url === s.url),
								);

								writer.write({
									type: "data-web-citations",
									data: citedSources,
								});

								await this.dbService.updateUsage(
									userId,
									webCitationUsage.totalTokens,
								);
							} catch (error) {
								captureError(error);
							}
						}

						const allParlaChunks: ParlaChunkData[] = steps.flatMap((step) =>
							step.toolResults
								.filter((tr) => tr.toolName === "parla_vector_search")
								.flatMap((tr) => parseParlaToolOutput(tr.output)),
						);

						if (allParlaChunks.length > 0) {
							try {
								const parlaCitationPromptClient = await getChatPrompt(
									"document-citation-extraction",
									{
										label:
											config.nodeEnv === "test"
												? "development"
												: config.nodeEnv,
									},
								);

								const compiledParlaCitationPrompts =
									parlaCitationPromptClient.compile({
										generatedAnswer: text,
										availableSources: allParlaChunks
											.map((c) => `[ID: ${c.id}]\n Snippet: ${c.content}`)
											.join("\n\n"),
									}) as ModelMessage[];

								const { output: parlaObject, usage: parlaCitationUsage } =
									await generateText({
										model: llmHandler.languageModel,
										messages: compiledParlaCitationPrompts,
										temperature: LLM_PARAMETERS.temperature,
										output: Output.object({
											schema: parlaCitationAnswerSchema,
										}),
										experimental_telemetry: {
											isEnabled: config.isTracingEnabled,
											functionId: "parla-citation-extraction",
											metadata: {
												sessionId: sessionId ? sessionId : "unknown",
											},
										},
									});

								const citedParlaChunks = allParlaChunks
									.filter((c) => parlaObject.citations.includes(c.id))
									.map(({ content, page, url, title, source_type }) => ({
										content,
										page,
										url,
										title,
										source_type,
									}));

								if (citedParlaChunks.length > 0) {
									writer.write({
										type: "data-parla-citations",
										data: citedParlaChunks,
									});
								}
								await this.dbService.updateUsage(
									userId,
									parlaCitationUsage.totalTokens,
								);
							} catch (error) {
								captureError(error);
							}
						}

						logMemory("chat:onFinish-complete", memoryLogId);
						updateActiveTrace({
							name: "streamed-text-generation",
							output: text,
							userId,
							sessionId,
						});

						await this.dbService.updateUsage(userId, usage.totalTokens);
					},
					experimental_telemetry: {
						isEnabled: config.isTracingEnabled,
						functionId: "streamed-text-with-tool-calls",
						metadata: {
							sessionId: sessionId ? sessionId : "unknown",
							langfusePrompt: langfusePrompt
								? langfusePrompt.toJSON()
								: undefined,
						},
					},
					onError: (error) => {
						logMemory("chat:onError", memoryLogId);
						captureError(error);
					},
				});

				writer.merge(streamResponse.toUIMessageStream());
			},
		});
		return createUIMessageStreamResponse({ stream });
	}

	async generateTextContent(args: {
		llmHandler: LLMHandler;
		messages: ModelMessage[];
		/**
		 * userId can be undefined when generating embeddings for default documents
		 * as they are not owned/uploaded by a specific user
		 */
		userId: string | undefined;
		langfusePrompt: TextPromptClient | ChatPromptClient;
	}): Promise<string> {
		const { llmHandler, messages, userId, langfusePrompt } = args;
		const { text, usage } = await generateText({
			model: llmHandler.languageModel,
			messages: messages,
			temperature: LLM_PARAMETERS.temperature,
			providerOptions: {
				mistral: {
					presencePenalty: LLM_PARAMETERS.presencePenalty,
					frequencyPenalty: LLM_PARAMETERS.frequencyPenalty,
				},
			},
			experimental_telemetry: {
				isEnabled: config.isTracingEnabled,
				metadata: {
					sessionId: "unknown",
					langfusePrompt: langfusePrompt.toJSON(),
				},
			},
		});

		if (userId) {
			await this.dbService.updateUsage(userId, usage.totalTokens);
		}
		return text;
	}

	/**
	 * Creates a system prompt and inserts it at the beginning conversation
	 * @returns An array of ChatMessages for the LLM
	 */

	async createPrompt(args: {
		previousMessages: ModelMessage[];
		isAddressedFormal: boolean;
		activeTools: ActiveTools[];
		userSystemPrompt?: string | null;
	}) {
		const {
			previousMessages,
			isAddressedFormal,
			activeTools,
			userSystemPrompt,
		} = args;

		const currentDate = new Date().toLocaleDateString("de-DE", {
			year: "numeric",
			month: "long",
			day: "numeric",
		});

		const addressForm = isAddressedFormal ? "Sieze" : "Duze";
		const label = config.nodeEnv === "test" ? "development" : config.nodeEnv;

		const freeChatPromptClient = await getTextPrompt("free-chat-basic", {
			label,
		});
		const activeToolSet = new Set(activeTools);
		const toolInstructionBlocks: string[] = [];
		for (const [tool, promptName] of TOOL_INSTRUCTION_PROMPTS) {
			if (!activeToolSet.has(tool)) {
				continue;
			}
			const blockClient = await getTextPrompt(promptName, { label });
			toolInstructionBlocks.push(blockClient.compile({}));
		}
		const toolInstructions = toolInstructionBlocks.join("\n\n");

		const compiledFreeChatPrompt = freeChatPromptClient.compile({
			currentDate: currentDate,
			addressForm: addressForm,
			userSystemPrompt: buildUserSystemPromptBlock(userSystemPrompt),
			toolInstructions: toolInstructions,
		});

		const freeChatPrompt: ModelMessage = {
			role: "system",
			content: compiledFreeChatPrompt,
		};

		return {
			messages: [freeChatPrompt, ...previousMessages],
			promptClient: freeChatPromptClient,
		};
	}

	private async getRelevantTools(options: {
		allowedDocumentIds: number[];
		allowedFolderIds: number[];
		activeTools: string[];
		userId?: string;
	}): Promise<RelevantTools> {
		const { allowedDocumentIds, allowedFolderIds, activeTools, userId } =
			options;

		const relevantTools: RelevantTools = {
			tools: {},
			toolChoice: "none",
			cleanup: async () => {},
		};

		const hasAllowedDocumentsOrFolders =
			allowedDocumentIds.length > 0 || allowedFolderIds.length > 0;
		if (hasAllowedDocumentsOrFolders) {
			relevantTools.tools.ragSearchTool = await ragSearchTool({
				allowedDocumentIds,
				allowedFolderIds,
				userId,
				dbService: this.dbService,
				embeddingService: this.embeddingService,
			});
			relevantTools.toolChoice = "auto";
		}

		if (activeTools.includes("webSearchTool")) {
			relevantTools.tools.webSearchTool = webSearchTool;
			relevantTools.toolChoice = "auto";
		}

		if (activeTools.includes("parlaMCPTools")) {
			const parlaMCPToolsResponse = await parlaMCPTools();
			if (parlaMCPToolsResponse) {
				relevantTools.tools = {
					...relevantTools.tools,
					...parlaMCPToolsResponse.tools,
				};
				relevantTools.toolChoice = "auto";
				relevantTools.cleanup = parlaMCPToolsResponse.cleanup;
			}
		}

		return relevantTools;
	}
}
