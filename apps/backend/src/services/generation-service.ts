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
import { resilientCall } from "../utils";
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
	 * Compress content to fit within a token limit by generating summaries iteratively.
	 * 1) If content is already within token limit, return as is.
	 * 2) Otherwise, generate a summary and check token count.
	 * 		Repeat up to maxRounds times or until content fits within token limit.
	 * 3) If still over token limit after maxRounds, trim content to fit.
	 */
	async compressToTokenLimit(args: {
		llmIdentifier: string;
		content: string;
		tokenLimit: number;
		maxRounds: number;
	}): Promise<string> {
		const { llmIdentifier, content, tokenLimit, maxRounds } = args;

		if (countTokens(content) <= tokenLimit) {
			return content;
		}

		let current = content;
		let tokens = countTokens(current);

		for (let round = 0; round < maxRounds && tokens > tokenLimit; round++) {
			current = await this.generateSummary({
				llmIdentifier,
				input: current,
			});

			tokens = countTokens(current);
		}

		if (tokens <= tokenLimit) {
			return current;
		}

		return trimToTokenLimitByWords(current, tokenLimit);
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
		userId?: string;
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
		userId?: string;
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

	async generateTags(
		llmIdentifier: string,
		docInput: string | ParsedPage[],
		{ userId }: { userId?: string } = {},
	): Promise<string[] | null> {
		const llmHandler = modelService.resolveLlmHandler(llmIdentifier);
		const docContent =
			typeof docInput === "string"
				? docInput
				: docInput.map((page) => page.content).join("\n");

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
		summaryEmbedding: number[];
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

		const summaryForEmbedding = await this.compressToTokenLimit({
			llmIdentifier,
			content: summary,
			tokenLimit: config.jinaMaxContextTokens,
			maxRounds: 3,
		});

		const summaryEmbeddingResponse =
			await this.embeddingService.generateJinaEmbedding(
				summaryForEmbedding,
				"retrieval.passage",
				userId,
			);

		const tags = await this.generateTags(llmIdentifier, summary, {
			userId,
		});

		return {
			summary,
			shortSummary,
			tags,
			summaryEmbedding: summaryEmbeddingResponse.embedding,
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
		const stream = createUIMessageStream({
			execute: async ({ writer }) => {
				const streamResponse = await resilientCall(
					async () =>
						streamText({
							model: llmHandler.languageModel,
							messages: messages,
							temperature: LLM_PARAMETERS.temperature,
							providerOptions: {
								mistral: {
									presencePenalty: LLM_PARAMETERS.presencePenalty,
									frequencyPenalty: LLM_PARAMETERS.frequencyPenalty,
								},
							},
							onFinish: async ({ text, usage }) => {
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

									const { output: citationObject, usage: generateObjectUsage } =
										await generateText({
											model: llmHandler.languageModel,
											system: `Du bist ein Assistent, der Quellenangaben extrahiert. Analysiere die gegebene Antwort und identifiziere, welche der verfügbaren Quellen tatsächlich verwendet wurden, um diese Antwort zu generieren. Gib NUR die IDs der Quellen zurück, deren Inhalt direkt in der Antwort verwendet oder paraphrasiert wurde.`,
											prompt: `Generierte Antwort:
"""
${text}
"""

Verfügbare Quellen:
${availableSources.map((s: { id: number; snippet: string }) => `[ID: ${s.id}]\n Snippet: ${s.snippet}`).join("\n\n")}

Analysiere die Antwort und identifiziere, welche Quellen-IDs für die Antwort verwendet wurden. Gib NUR diese IDs als Array zurück.`,
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
										});

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
								}
								if (allWebSources.length > 0) {
									const { output: webObject, usage: webCitationUsage } =
										await generateText({
											model: llmHandler.languageModel,
											system: `Du bist ein Assistent, der Quellenangaben extrahiert. Analysiere die gegebene Antwort und identifiziere, welche der verfügbaren Webquellen tatsächlich verwendet wurden, um diese Antwort zu generieren. Gib NUR die Quellen zurück, deren Inhalt direkt in der Antwort verwendet oder paraphrasiert wurde.`,
											prompt: `Generierte Antwort:
"""
${text}
"""

Verfügbare Webquellen:
${allWebSources.map((s) => `[URL: ${s.url}]\n Snippet: ${s.snippet}\n Titel: ${s.title}`).join("\n\n")}

Analysiere die Antwort und identifiziere, welche Webquellen für die Antwort verwendet wurden. Gib NUR diese Webquellen im Feld "citations" als Array von Objekten mit "url", "title" und "snippet" zurück.`,
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
										});

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
								}

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
		langfusePrompt: TextPromptClient | ChatPromptClient;
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
		if (config.nodeEnv === "development") {
			const freeChatPrompt = `
Du bist ein hilfreicher Assistent mit Zugang zu aktuellen Webinhalten über ein Websuch-Tool.

Aktuelles Datum: ${currentDate}

Antworte immer auf Deutsch. ${addressForm} die Nutzerin bzw. den Nutzer.

Du hast Zugriff auf ein Websuch-Tool (webSearchTool). Nutze es aktiv, wenn:
- die Frage aktuelle Informationen erfordert (Nachrichten, Preise, Ereignisse, Gesetze, etc.)
- dein Trainingswissen möglicherweise veraltet ist
- die Nutzerin / der Nutzer explizit nach aktuellen Informationen fragt

Nenne keine URLs, Domains oder Quellnamen direkt in deiner Antwort. Quellen werden dem Nutzer separat angezeigt.
Wenn die Suche keine nützlichen Ergebnisse liefert, teile das transparent mit.
`;
			return {
				messages: [
					{ role: "system", content: freeChatPrompt },
					...previousMessages,
				],
				promptClient: undefined,
			};
		}
		// Always use free-chat prompt
		const freeChatPromptClient = await langfuse.prompt.get(
			"free-chat",
			{ label: config.nodeEnv === "test" ? "development" : config.nodeEnv }, // Fallback to development prompt version during tests
		);
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

		if (!config.featureFlagMcpParlaAllowed) {
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
