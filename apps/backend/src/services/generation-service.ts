import { enc } from "../constants";
import { config } from "../config";
import type { ModelMessage, Tool, ToolChoice } from "ai";
import {
	createUIMessageStream,
	createUIMessageStreamResponse,
	generateText,
	Output,
	stepCountIs,
	streamText,
} from "ai";
import { ModelService } from "./model-service";
import { logMemory } from "../monitoring/memory-logger";
import { EmbeddingService } from "./embedding-service";
import {
	LangfuseClient,
	ChatPromptClient,
	TextPromptClient,
} from "@langfuse/client";
import { updateActiveTrace } from "@langfuse/tracing";
import {
	type Document,
	type KnowledgeBaseDocument,
	type LLMHandler,
} from "../types/common";
import { BaseContentDbService } from "./db-service/base-db-service";
import { LLM_PARAMETERS } from "../constants";
import type { ActiveTools, ParsedPage } from "../types/common";
import { baseKnowledgeSearchTool } from "../tools/base-knowledge-search-tool";
import { ragSearchTool } from "../tools/rag-search-tool";
import { parlaMCPTools } from "../tools/mcp/parla-mcp-tools";
import { webSearchTool } from "../tools/web-search";
import { captureError } from "../monitoring/capture-error";
import {
	citationAnswerSchema,
	webCitationAnswerSchema,
} from "../schemas/citation-answer-schema";
import { resilientCall, wait } from "../utils";
import {
	countTokens,
	computeSafePayload,
	trimToTokenLimitByWords,
} from "./token-utils";
import type { WebSearchResult } from "../tools/web-search";

const langfuse = new LangfuseClient();
const modelService = new ModelService();

type RelevantTools = {
	tools: Record<string, Tool>;
	toolChoice: ToolChoice<Record<string, Tool>>;
	maxSteps: number;
	useBaseKnowledgeAfterFirstStep: boolean;
	cleanup?: () => Promise<void>;
};

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
			const client = await resilientCall(() =>
				langfuse.prompt.get(promptName, {
					label: config.nodeEnv === "test" ? "development" : config.nodeEnv,
					type: "chat",
				}),
			);

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

		const summaryPromptClient = await langfuse.prompt.get("summary", {
			label: config.nodeEnv === "test" ? "development" : config.nodeEnv,
			type: "chat",
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

		const summaryPromptClient = await langfuse.prompt.get(
			"one-sentence-summary",
			{
				label: config.nodeEnv === "test" ? "development" : config.nodeEnv,
				type: "chat",
			},
		);

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

		const taggingPromptClient = await langfuse.prompt.get("tagging", {
			label: config.nodeEnv === "test" ? "development" : config.nodeEnv,
			type: "chat",
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

	async generateTextStreamResponse(
		llmHandler: LLMHandler,
		messages: ModelMessage[],
		{
			userId,
			sessionId,
			langfusePrompt,
			allowedDocumentIds = [],
			allowedFolderIds = [],
			activeTools = [] as ActiveTools[],
		}: {
			userId?: string;
			sessionId?: string;
			langfusePrompt?: TextPromptClient | ChatPromptClient;
			allowedDocumentIds?: number[];
			allowedFolderIds?: number[];
			activeTools?: ActiveTools[];
		} = {},
	): Promise<Response> {
		const reqId = sessionId ? String(sessionId).slice(0, 8) : "no-session";
		logMemory("chat:start", reqId);
		let knowledgeBaseDocuments: KnowledgeBaseDocument[] = [];
		if (activeTools.includes("baseKnowledgeSearchTool") && userId) {
			knowledgeBaseDocuments =
				await this.dbService.getBaseKnowledgeDocuments(userId);
		}
		const {
			tools,
			toolChoice,
			maxSteps,
			useBaseKnowledgeAfterFirstStep,
			cleanup: toolsCleanup,
		} = await this.getRelevantTools({
			allowedDocumentIds,
			allowedFolderIds,
			activeTools,
			userId,
			knowledgeBaseDocuments,
		});

		const prepareStep = this.getPrepareStep(useBaseKnowledgeAfterFirstStep);

		updateActiveTrace({ input: messages[messages.length - 1].content });
		const generationResult = await resilientCall(
			() =>
				generateText({
					model: llmHandler.languageModel,
					messages: messages,
					maxOutputTokens: 8192,
					temperature: LLM_PARAMETERS.temperature,
					tools,
					toolChoice,
					stopWhen: stepCountIs(maxSteps),
					prepareStep,
					providerOptions: {
						mistral: {
							presencePenalty: LLM_PARAMETERS.presencePenalty,
							frequencyPenalty: LLM_PARAMETERS.frequencyPenalty,
						},
					},
					experimental_telemetry: {
						isEnabled:
							config.nodeEnv !== "test" && config.nodeEnv !== "production", // Disable telemetry in CI and production
						functionId: "text-toolCall-generation",
						metadata: {
							sessionId: sessionId ? sessionId : "unknown",
							langfusePrompt: langfusePrompt
								? langfusePrompt.toJSON()
								: undefined,
						},
					},
				}),
			{ queueType: "llm" },
		);
		logMemory(
			`chat:after-generateText (steps=${generationResult.steps.length}, tokens=${generationResult.usage?.totalTokens ?? 0})`,
			reqId,
		);
		if (userId && generationResult.usage?.totalTokens) {
			try {
				await this.dbService.updateUserColumnValue(
					userId,
					"num_inference_tokens",
					generationResult.usage.totalTokens,
				);
				await this.dbService.updateUserColumnValue(userId, "num_inferences", 1);
			} catch (error) {
				captureError(error);
			}
		}
		const allChunkMatches = generationResult.steps.flatMap((step) =>
			step.toolResults.flatMap((tr) => tr.output?.chunkMatches || []),
		);

		const allWebSources = generationResult.steps.flatMap((step) =>
			step.toolResults.flatMap((tr) => {
				const generic = tr.output?.grounding
					?.generic as WebSearchResult["grounding"]["generic"];
				const sources = tr.output?.sources as WebSearchResult["sources"];
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
		const newMessages = generationResult.response.messages;
		if (newMessages.length > 0) {
			messages.push(...newMessages);
		}

		/**
		 * calling the Mistral API immediately after another LLM call can sometimes
		 * lead to issues, so we add a short delay here as a workaround
		 */
		await wait(100);

		const stream = createUIMessageStream({
			execute: async ({ writer }) => {
				const streamResponse = await resilientCall(
					async () =>
						streamText({
							model: llmHandler.languageModel,
							messages: messages,
							maxOutputTokens: 8192,
							temperature: LLM_PARAMETERS.temperature,
							providerOptions: {
								mistral: {
									presencePenalty: LLM_PARAMETERS.presencePenalty,
									frequencyPenalty: LLM_PARAMETERS.frequencyPenalty,
								},
							},
							onFinish: async ({ text, usage }) => {
								logMemory(
									`chat:onFinish (textLen=${text.length}, tokens=${usage?.totalTokens ?? 0})`,
									reqId,
								);
								if (typeof toolsCleanup === "function") {
									await toolsCleanup();
								}

								if (allChunkMatches.length > 0) {
									const availableSources = allChunkMatches.map(
										(match: { chunkId: number; snippet: string }) => ({
											id: match.chunkId,
											snippet: match.snippet,
										}),
									);
									try {
										const citationPromptClient = await resilientCall(
											() =>
												langfuse.prompt.get("document-citation-extraction", {
													type: "chat",
													label:
														config.nodeEnv === "test"
															? "development"
															: config.nodeEnv,
												}),
											{ queueType: "llm" },
										);
										const compiledDocumentCitationExtractionPrompts =
											citationPromptClient.compile({
												generatedAnswer: text,
												availableSources: availableSources
													.map((s) => `[ID: ${s.id}]\n Snippet: ${s.snippet}`)
													.join("\n\n"),
											}) as ModelMessage[];

										const {
											output: citationObject,
											usage: generateObjectUsage,
										} = await resilientCall(
											() =>
												generateText({
													model: llmHandler.languageModel,
													messages: compiledDocumentCitationExtractionPrompts,
													temperature: LLM_PARAMETERS.temperature,
													output: Output.object({
														schema: citationAnswerSchema,
													}),
													experimental_telemetry: {
														isEnabled:
															config.nodeEnv !== "test" &&
															config.nodeEnv !== "production", // Disable telemetry in CI and production
														functionId: "citation-extraction",
														metadata: {
															sessionId: sessionId ? sessionId : "unknown",
														},
													},
												}),
											{ queueType: "llm" },
										);

										writer.write({
											type: "data-citations",
											data: citationObject.citations,
										});

										try {
											await this.dbService.updateUserColumnValue(
												userId,
												"num_inference_tokens",
												generateObjectUsage.totalTokens,
											);
											await this.dbService.updateUserColumnValue(
												userId,
												"num_inferences",
												1,
											);
										} catch (error) {
											captureError(error);
										}
									} catch (error) {
										captureError(error);
									}
								}
								if (allWebSources.length > 0) {
									try {
										const webCitationPromptClient = await resilientCall(
											() =>
												langfuse.prompt.get("web-citation-extraction", {
													label:
														config.nodeEnv === "test"
															? "development"
															: config.nodeEnv,
													type: "chat",
												}),
											{ queueType: "llm" },
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
											await resilientCall(
												() =>
													generateText({
														model: llmHandler.languageModel,
														messages: compiledWebCitationExtractionPrompts,
														temperature: LLM_PARAMETERS.temperature,
														output: Output.object({
															schema: webCitationAnswerSchema,
														}),
														experimental_telemetry: {
															isEnabled:
																config.nodeEnv !== "test" &&
																config.nodeEnv !== "production",
															functionId: "web-citation-extraction",
															metadata: {
																sessionId: sessionId ? sessionId : "unknown",
															},
														},
													}),
												{ queueType: "llm" },
											);

										const citedSources = allWebSources.filter((s) =>
											webObject.citations.some((c) => c.url === s.url),
										);

										writer.write({
											type: "data-web-citations",
											data: citedSources,
										});

										if (userId) {
											try {
												await this.dbService.updateUserColumnValue(
													userId,
													"num_inference_tokens",
													webCitationUsage.totalTokens,
												);
												await this.dbService.updateUserColumnValue(
													userId,
													"num_inferences",
													1,
												);
											} catch (error) {
												captureError(error);
											}
										}
									} catch (error) {
										captureError(error);
									}
								}

								logMemory("chat:onFinish-complete", reqId);
								updateActiveTrace({
									name: "streamed-text-generation",
									output: text,
									userId,
									sessionId,
								});
								// Handle token usage tracking after stream completes
								if (userId && usage?.totalTokens) {
									try {
										await this.dbService.updateUserColumnValue(
											userId,
											"num_inference_tokens",
											usage.totalTokens,
										);
										// Increase num_inferences for user by one
										await this.dbService.updateUserColumnValue(
											userId,
											"num_inferences",
											1,
										);
									} catch (dbError) {
										captureError(dbError);
									}
								}
							},
							experimental_telemetry: {
								isEnabled:
									config.nodeEnv !== "test" && config.nodeEnv !== "production", // Disable telemetry in CI and production
								metadata: {
									sessionId: sessionId ? sessionId : "unknown",
									langfusePrompt: langfusePrompt
										? langfusePrompt.toJSON()
										: undefined,
								},
							},
							onError: (error) => {
								logMemory("chat:onError", reqId);
								captureError(error);
							},
						}),
					{ queueType: "llm" },
				);
				writer.merge(streamResponse.toUIMessageStream());
			},
		});
		return createUIMessageStreamResponse({ stream });
	}

	async generateTextContent(args: {
		llmHandler: LLMHandler;
		messages: ModelMessage[];
		userId: string;
		langfusePrompt?: TextPromptClient | ChatPromptClient;
	}): Promise<string> {
		const { llmHandler, messages, userId, langfusePrompt } = args;
		const { text, usage } = await resilientCall(
			() =>
				generateText({
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
						isEnabled:
							config.nodeEnv !== "test" && config.nodeEnv !== "production", // Disable telemetry in CI and production
						metadata: {
							sessionId: "unknown",
							langfusePrompt: langfusePrompt.toJSON(),
						},
					},
				}),
			{ queueType: "llm" },
		);
		if (userId) {
			// Increase num_inferences for user by 1
			await this.dbService.updateUserColumnValue(userId, "num_inferences", 1);
			// Increase num_tokens by token count of this generation
			await this.dbService.updateUserColumnValue(
				userId,
				"num_inference_tokens",
				usage.totalTokens,
			);
		}
		return text;
	}

	/**
	 * Creates a prompt for either an initial query or a follow-up query in a conversation
	 * @param params - Either a GenerateAnswerBody object or an array of ChatMessage objects
	 * @returns An array of ChatMessages for the LLM
	 */

	async createPrompt(
		previousMessages: ModelMessage[],
		isAddressedFormal: boolean,
		activeTools: ActiveTools[],
	): Promise<{
		messages: ModelMessage[];
		promptClient: TextPromptClient;
	}> {
		const currentDate = new Date().toLocaleDateString("de-DE", {
			year: "numeric",
			month: "long",
			day: "numeric",
		});

		const addressForm = isAddressedFormal ? "Sieze" : "Duze";
		let freeChatPromptClient: TextPromptClient;

		const effectiveActiveTools = [...activeTools];
		// TODO: Remove the check for feature flag once frontend functionality to add web search tool in chat is implemented
		if (
			config.featureFlagWebSearchAllowed &&
			!effectiveActiveTools.includes("webSearchTool")
		) {
			effectiveActiveTools.push("webSearchTool");
		}

		if (effectiveActiveTools.includes("webSearchTool")) {
			try {
				freeChatPromptClient = await langfuse.prompt.get(
					"free-chat-with-web-search-enabled",
					{ label: config.nodeEnv === "test" ? "development" : config.nodeEnv },
				);
			} catch (error) {
				captureError(error);
				throw error;
			}
		} else {
			try {
				freeChatPromptClient = await langfuse.prompt.get(
					"free-chat",
					{ label: config.nodeEnv === "test" ? "development" : config.nodeEnv }, // Fallback to development prompt version during tests
				);
			} catch (error) {
				captureError(error);
				throw error;
			}
		}
		const compiledFreeChatPrompt = freeChatPromptClient.compile({
			currentDate: currentDate,
			addressForm: addressForm,
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
		knowledgeBaseDocuments?: KnowledgeBaseDocument[];
	}): Promise<RelevantTools> {
		const optionsCopy = { ...options, activeTools: [...options.activeTools] };

		// TODO: Remove this default value once frontend functionality is implemented
		if (
			config.featureFlagWebSearchAllowed &&
			!optionsCopy.activeTools.includes("webSearchTool")
		) {
			optionsCopy.activeTools.push("webSearchTool");
		}

		if (
			!config.featureFlagMcpParlaAllowed &&
			!config.featureFlagWebSearchAllowed
		) {
			return this.getRelevantToolsV1(optionsCopy);
		}

		return this.getRelevantToolsV2(optionsCopy);
	}

	/**
	 * Original implementation (pre-mcp addition)
	 */
	private async getRelevantToolsV1(options: {
		allowedDocumentIds: number[];
		allowedFolderIds: number[];
		activeTools: string[];
		userId?: string;
		knowledgeBaseDocuments?: KnowledgeBaseDocument[];
	}): Promise<RelevantTools> {
		const {
			allowedDocumentIds,
			allowedFolderIds,
			activeTools,
			userId,
			knowledgeBaseDocuments,
		} = options;

		const hasAllowedDocumentsOrFolders =
			allowedDocumentIds.length > 0 || allowedFolderIds.length > 0;
		const ragTool = ragSearchTool({
			allowedDocumentIds,
			allowedFolderIds,
			userId,
			dbService: this.dbService,
			embeddingService: this.embeddingService,
		});
		const baseKnowledgeTool = knowledgeBaseDocuments
			? baseKnowledgeSearchTool({
					knowledgeBaseDocuments,
					userId,
					dbService: this.dbService,
					embeddingService: this.embeddingService,
				})
			: null;

		// Case 1: Both RAG and base knowledge are active
		if (
			hasAllowedDocumentsOrFolders &&
			activeTools.includes("baseKnowledgeSearchTool") &&
			baseKnowledgeTool
		) {
			return {
				tools: {
					ragSearchTool: ragTool,
					baseKnowledgeSearchTool: baseKnowledgeTool,
				},
				toolChoice: { type: "tool", toolName: "ragSearchTool" },
				maxSteps: 2,
				useBaseKnowledgeAfterFirstStep: true,
			};
		}

		// Case 2: Only RAG is active
		if (hasAllowedDocumentsOrFolders) {
			return {
				tools: {
					ragSearchTool: ragSearchTool({
						allowedDocumentIds,
						allowedFolderIds,
						userId,
						dbService: this.dbService,
						embeddingService: this.embeddingService,
					}),
				},
				toolChoice: { type: "tool", toolName: "ragSearchTool" },
				maxSteps: 1,
				useBaseKnowledgeAfterFirstStep: false,
			};
		}

		// Case 3: Only base knowledge is active
		if (activeTools.includes("baseKnowledgeSearchTool") && baseKnowledgeTool) {
			return {
				tools: {
					baseKnowledgeSearchTool: baseKnowledgeTool,
				},
				toolChoice: {
					type: "tool",
					toolName: "baseKnowledgeSearchTool",
				},
				maxSteps: 1,
				useBaseKnowledgeAfterFirstStep: false,
			};
		}

		// Case 4: No tools active
		return {
			tools: {},
			toolChoice: "none",
			maxSteps: 1,
			useBaseKnowledgeAfterFirstStep: false,
		};
	}

	/**
	 * WIP implementation after MCP addition.
	 */
	private async getRelevantToolsV2(options: {
		allowedDocumentIds: number[];
		allowedFolderIds: number[];
		activeTools: string[];
		userId?: string;
		knowledgeBaseDocuments?: KnowledgeBaseDocument[];
	}): Promise<RelevantTools> {
		const {
			allowedDocumentIds,
			allowedFolderIds,
			activeTools,
			userId,
			knowledgeBaseDocuments,
		} = options;

		const relevantTools: RelevantTools = {
			tools: {},
			toolChoice: "none",
			maxSteps: 1,
			useBaseKnowledgeAfterFirstStep: false,
			cleanup: async () => {},
		};

		if (
			activeTools.includes("baseKnowledgeSearchTool") &&
			knowledgeBaseDocuments
		) {
			relevantTools.tools.baseKnowledgeSearchTool = baseKnowledgeSearchTool({
				knowledgeBaseDocuments,
				userId,
				dbService: this.dbService,
				embeddingService: this.embeddingService,
			});
			relevantTools.toolChoice = "auto";
		}

		const hasAllowedDocumentsOrFolders =
			allowedDocumentIds.length > 0 || allowedFolderIds.length > 0;
		if (hasAllowedDocumentsOrFolders) {
			relevantTools.tools.ragSearchTool = ragSearchTool({
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

		relevantTools.maxSteps = Math.max(
			1,
			Object.keys(relevantTools.tools).length,
		);

		return relevantTools;
	}

	private getPrepareStep(useBaseKnowledgeAfterFirstStep: boolean):
		| (({ stepNumber }: { stepNumber: number }) => {
				toolChoice?: {
					type: "tool";
					toolName: "baseKnowledgeSearchTool";
				};
				activeTools?: string[];
		  })
		| undefined {
		if (!useBaseKnowledgeAfterFirstStep) {
			return undefined;
		}

		return ({ stepNumber }: { stepNumber: number }) => {
			if (stepNumber === 1) {
				return {
					toolChoice: {
						type: "tool",
						toolName: "baseKnowledgeSearchTool",
					} as const,
					activeTools: ["baseKnowledgeSearchTool"],
				};
			}
			return {};
		};
	}
}
