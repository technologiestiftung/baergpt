import { enc } from "../constants";
import { config } from "../config";
import type { ModelMessage, Tool, ToolChoice } from "ai";
import {
	createUIMessageStream,
	createUIMessageStreamResponse,
	generateObject,
	generateText,
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
import type { ParsedPage } from "../types/common";
import { baseKnowledgeSearchTool } from "../tools/base-knowledge-search-tool";
import { ragSearchTool } from "../tools/rag-search-tool";
import { parlaMCPTools } from "../tools/mcp/parla-mcp-tools";
import { captureError } from "../monitoring/capture-error";
import { citationAnswerSchema } from "../schemas/citation-answer-schema";
import { resilientCall } from "../utils";
import {
	countTokens,
	computeSafePayload,
	trimToTokenLimitByWords,
} from "./token-utils";

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
	 * Select the first pages whose combined content fits within a safe token budget
	 * for the summary prompt. Falls back to at least the first page if none fit.
	 */
	private async selectFirstPagesFittingBudget(
		llmIdentifier: string,
		parsedPages: ParsedPage[],
	): Promise<ParsedPage[]> {
		const contextSize = modelService.availableModels[llmIdentifier].contextSize;
		const systemTokensForSummary =
			await this.estimateSystemPromptTokens("summary");
		const safeTokenLimit = computeSafePayload(
			contextSize,
			systemTokensForSummary,
		);

		const selected: ParsedPage[] = [];
		let accumulatedTokens = 0;

		for (const page of parsedPages) {
			const pageTokens = page.tokenCount ?? countTokens(page.content);
			if (accumulatedTokens + pageTokens > safeTokenLimit) {
				break;
			}
			accumulatedTokens += pageTokens;
			selected.push(page);
		}

		return selected.length > 0 ? selected : parsedPages.slice(0, 1);
	}

	/**
	 * Compress content to a target token limit by:
	 * 1) attempting up to `maxRounds` model compressions, then
	 * 2) hard-trimming with a binary search as a final safeguard.
	 */
	private async compressToTokenLimit(
		llmIdentifier: string,
		content: string,
		options: { tokenLimit: number; maxRounds?: number } = { tokenLimit: 0 },
	): Promise<string> {
		const { tokenLimit, maxRounds = 3 } = options;
		let current = content;
		let tokens = countTokens(current);

		for (let round = 0; round < maxRounds && tokens > tokenLimit; round++) {
			const shorter = await this.generateSummary(llmIdentifier, current);
			if (!shorter) {
				break;
			}
			current = shorter;
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

	async generateSummary(
		llmIdentifier: string,
		docInput: string | ParsedPage[],
		{
			oneSentenceSummary = false,
			userId,
		}: {
			oneSentenceSummary?: boolean;
			userId?: string;
		} = {},
	): Promise<string | null> {
		const llmHandler = modelService.resolveLlmHandler(llmIdentifier);
		let compiledSummaryPrompt: ModelMessage[];
		let summaryPromptClient: ChatPromptClient;
		const docContent =
			typeof docInput === "string"
				? docInput
				: docInput.map((page) => page.content).join("\n");

		if (oneSentenceSummary) {
			summaryPromptClient = await langfuse.prompt.get("one-sentence-summary", {
				label: config.nodeEnv === "test" ? "development" : config.nodeEnv,
				type: "chat",
			});
			compiledSummaryPrompt = summaryPromptClient.compile({
				docContent: docContent,
			}) as ModelMessage[];
		} else {
			summaryPromptClient = await langfuse.prompt.get("summary", {
				label: config.nodeEnv === "test" ? "development" : config.nodeEnv,
				type: "chat",
			});
			compiledSummaryPrompt = summaryPromptClient.compile({
				docContent: docContent,
			}) as ModelMessage[];
		}

		try {
			return this.generateTextContent(llmHandler, compiledSummaryPrompt, {
				userId,
				langfusePrompt: summaryPromptClient,
			});
		} catch (error) {
			captureError(error);
			return null;
		}
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

		try {
			const response: string = await this.generateTextContent(
				llmHandler,
				compiledTaggingPrompt,
				{ userId, langfusePrompt: taggingPromptClient },
			);
			// Extract JSON from potential code block artifacts
			const jsonMatch = response.match(
				/```(?:json)?\s*(\{.*?\})\s*```|(\{.*?\})/s,
			);
			const jsonString = jsonMatch ? jsonMatch[1] || jsonMatch[2] : response;
			const parsed = JSON.parse(jsonString.trim());
			return parsed.tags || [];
		} catch (error) {
			captureError(error);
			return null;
		}
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
		const numTokens = parsedPages.reduce(
			(total, page) => total + (page.tokenCount ?? countTokens(page.content)),
			0,
		);

		let summary: string | null = null;
		const MAX_TOKEN_COUNT_FOR_SUMMARY =
			modelService.availableModels[llmIdentifier].contextSize;
		const userId = document.owned_by_user_id || document.uploaded_by_user_id;

		const overContext = numTokens > MAX_TOKEN_COUNT_FOR_SUMMARY;
		let summaryInput: string | ParsedPage[] = parsedPages;

		if (overContext) {
			const selectedPages = await this.selectFirstPagesFittingBudget(
				llmIdentifier,
				parsedPages,
			);
			summaryInput = selectedPages;
		}

		// Safety mechanism in case the first page is larger than MAX_TOKEN_COUNT_FOR_SUMMARY
		const systemTokens = await this.estimateSystemPromptTokens("summary");
		const safeLimit = computeSafePayload(
			MAX_TOKEN_COUNT_FOR_SUMMARY,
			systemTokens,
		);

		let joined;
		if (typeof summaryInput === "string") {
			joined = summaryInput;
		} else {
			joined = summaryInput.map((page) => page.content).join("\n");
		}
		if (countTokens(joined) > safeLimit) {
			summaryInput = trimToTokenLimitByWords(joined, safeLimit);
		}

		summary = await this.generateSummary(llmIdentifier, summaryInput, {
			userId,
		});

		if (!summary) {
			throw new Error("Failed to generate document summary");
		}

		const shortSummary = await this.generateSummary(llmIdentifier, summary, {
			oneSentenceSummary: true,
			userId,
		});

		if (!shortSummary) {
			throw new Error("Failed to generate short document summary");
		}

		const summaryForEmbedding = await this.compressToTokenLimit(
			llmIdentifier,
			summary,
			{ tokenLimit: config.jinaMaxContextTokens, maxRounds: 3 },
		);

		const summaryEmbeddingResponse =
			await this.embeddingService.generateJinaEmbedding(
				summaryForEmbedding,
				"retrieval.passage",
				userId,
			);

		if (!summaryEmbeddingResponse || !summaryEmbeddingResponse.embedding) {
			throw new Error("Failed to generate document embedding");
		}

		const tags = await this.generateTags(llmIdentifier, summary, {
			userId,
		});

		if (!tags) {
			throw new Error("Failed to generate document tags");
		}

		return {
			summary,
			shortSummary,
			tags,
			summaryEmbedding: summaryEmbeddingResponse.embedding,
		};
	}

	async generateTextStreamResponse(
		llmHandler: LLMHandler,
		messages: ModelMessage[],
		{
			userId,
			sessionId,
			messageId,
			langfusePrompt,
			allowedDocumentIds = [],
			allowedFolderIds = [],
			isBaseKnowledgeActive,
			isParlaMCPToolActive,
		}: {
			userId?: string;
			sessionId?: string;
			messageId?: number;
			langfusePrompt?: TextPromptClient | ChatPromptClient;
			allowedDocumentIds?: number[];
			allowedFolderIds?: number[];
			isBaseKnowledgeActive?: boolean;
			isParlaMCPToolActive?: boolean;
		} = {},
	): Promise<Response> {
		let knowledgeBaseDocuments: KnowledgeBaseDocument[] = [];
		if (isBaseKnowledgeActive && userId) {
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
			isBaseKnowledgeActive: isBaseKnowledgeActive ?? false,
			userId,
			knowledgeBaseDocuments,
			isParlaMCPToolActive,
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
		const allParlaCitations = generationResult.steps.flatMap((step) =>
			step.toolResults.flatMap((tr) => tr.output?.parlaCitations || []),
		);

		// Save external citations to database
		if (messageId && allParlaCitations.length > 0) {
			try {
				await this.dbService.saveExternalCitations(
					messageId,
					allParlaCitations,
				);
			} catch (error) {
				captureError(error);
				console.error("Failed to save external citations:", error);
			}
		}

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

								const allCitationIds: number[] = [];

								if (allChunkMatches.length > 0) {
									const availableSources = allChunkMatches.map(
										(match: { chunkId: number; snippet: string }) => ({
											id: match.chunkId,
											snippet: match.snippet,
										}),
									);

									const { object, usage: generateObjectUsage } =
										await generateObject({
											model: llmHandler.languageModel,
											system: `Du bist ein Assistent, der Quellenangaben extrahiert. Analysiere die gegebene Antwort und identifiziere, welche der verfügbaren Quellen tatsächlich verwendet wurden, um diese Antwort zu generieren. Gib NUR die IDs der Quellen zurück, deren Inhalt direkt in der Antwort verwendet oder paraphrasiert wurde.`,
											prompt: `Generierte Antwort:
"""
${text}
"""

Verfügbare Quellen:
${availableSources.map((s: { id: number; snippet: string }) => `[ID: ${s.id}]\n${s.snippet}`).join("\n\n")}

Analysiere die Antwort und identifiziere, welche Quellen-IDs für die Antwort verwendet wurden. Gib NUR diese IDs als Array zurück.`,
											temperature: LLM_PARAMETERS.temperature,
											schema: citationAnswerSchema,
											experimental_telemetry: {
												isEnabled:
													config.nodeEnv !== "test" &&
													config.nodeEnv !== "production",
												functionId: "citation-extraction",
												metadata: {
													sessionId: sessionId ? sessionId : "unknown",
												},
											},
										});

									if (messageId && object.citations.length > 0) {
										const chunkCitationRows = object.citations.map(
											(chunkId: number) => ({
												documentChunkIds: [chunkId],
											}),
										);
										const ids =
											await this.dbService.saveChatMessageCitations(
												messageId,
												chunkCitationRows,
											);
										allCitationIds.push(...ids);
									}

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

								if (messageId && allParlaCitations.length > 0) {
									const externalCitationRows = allParlaCitations
										.filter(
											(c: { id?: string }) => c.id !== undefined,
										)
										.map((c: { id?: string }) => ({
											externalCitationIds: [c.id as string],
										}));
									const ids =
										await this.dbService.saveChatMessageCitations(
											messageId,
											externalCitationRows,
										);
									allCitationIds.push(...ids);
								}

								if (allCitationIds.length > 0) {
									writer.write({
										type: "data-citations",
										data: allCitationIds,
									});
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

	async generateTextContent(
		llmHandler: LLMHandler,
		messages: ModelMessage[],
		{
			userId,
			sessionId,
			langfusePrompt,
		}: {
			userId?: string;
			sessionId?: string;
			langfusePrompt?: TextPromptClient | ChatPromptClient;
		} = {},
	): Promise<string> {
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
							sessionId: sessionId ? sessionId : "unknown",
							langfusePrompt: langfusePrompt
								? langfusePrompt.toJSON()
								: undefined,
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
				usage?.totalTokens ?? 0,
			);
		}
		return text;
	}

	splitArrayEqually<T>(array: T[], chunkSize: number): T[][] {
		const result: T[][] = [];
		for (let i = 0; i < array.length; i += chunkSize) {
			result.push(array.slice(i, i + chunkSize));
		}
		return result;
	}

	splitInChunksAccordingToTokenLimit(
		input: string,
		tokenLimit: number,
		overlap: number = 128,
	): string[] {
		const finalChunks: string[] = [];

		// Split input into smaller chunks with overlap
		let currentChunk = "";
		const words = input.split(/\s+/);
		let currentOverlap = "";

		for (let i = 0; i < words.length; i++) {
			const currentWord = words[i];

			// If we're starting a new chunk after the first one, add overlap with the previous chunk
			if (currentChunk === "" && finalChunks.length > 0) {
				const overlapStart = this.getOverlapStart(words, i, overlap);
				currentOverlap = words.slice(overlapStart, i).join(" ");
				currentChunk = currentOverlap;
			}

			if (
				enc.encode(currentWord).length > tokenLimit ||
				enc.encode(`${currentOverlap} ${currentWord}`).length > tokenLimit
			) {
				// If a single word or the current overlap + the current word exceed token limit, we skip them
				continue;
			}

			const potentialChunk =
				currentChunk + (currentChunk ? " " : "") + currentWord;
			const tokenCountPotentialChunk = enc.encode(potentialChunk).length;

			if (tokenCountPotentialChunk <= tokenLimit) {
				currentChunk = potentialChunk;
				continue;
			}

			finalChunks.push(currentChunk);
			currentChunk = ""; // Reset current chunk
		}

		// Add final chunk if not empty
		if (currentChunk) {
			finalChunks.push(currentChunk);
		}

		return finalChunks;
	}

	getOverlapStart(words: string[], countStart: number, overlap: number) {
		let overlapTokenCount = 0;
		let overlapStart = countStart;

		// Count backwards until we reach desired overlap token count
		for (let j = countStart - 1; j >= 0; j--) {
			const wordTokens = enc.encode(words[j]).length;

			if (overlapTokenCount + wordTokens > overlap) {
				break;
			}

			overlapTokenCount += wordTokens;
			overlapStart = j;
		}

		return overlapStart;
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
		isBaseKnowledgeActive: boolean;
		userId?: string;
		knowledgeBaseDocuments?: KnowledgeBaseDocument[];
		isParlaMCPToolActive?: boolean;
	}): Promise<RelevantTools> {
		if (!config.featureFlagMcpParlaAllowed) {
			return this.getRelevantToolsV1(options);
		}

		return this.getRelevantToolsV2(options);
	}

	/**
	 * Original implementation (pre-mcp addition)
	 */
	private async getRelevantToolsV1(options: {
		allowedDocumentIds: number[];
		allowedFolderIds: number[];
		isBaseKnowledgeActive: boolean;
		userId?: string;
		knowledgeBaseDocuments?: KnowledgeBaseDocument[];
	}): Promise<RelevantTools> {
		const {
			allowedDocumentIds,
			allowedFolderIds,
			isBaseKnowledgeActive,
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
			isBaseKnowledgeActive &&
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
		if (isBaseKnowledgeActive && baseKnowledgeTool) {
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
		isBaseKnowledgeActive: boolean;
		userId?: string;
		knowledgeBaseDocuments?: KnowledgeBaseDocument[];
		isParlaMCPToolActive?: boolean;
	}): Promise<RelevantTools> {
		const {
			allowedDocumentIds,
			allowedFolderIds,
			isBaseKnowledgeActive,
			userId,
			knowledgeBaseDocuments,
			isParlaMCPToolActive,
		} = options;

		const relevantTools: RelevantTools = {
			tools: {},
			toolChoice: "none",
			maxSteps: 1,
			useBaseKnowledgeAfterFirstStep: false,
			cleanup: async () => {},
		};

		if (isBaseKnowledgeActive && knowledgeBaseDocuments) {
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

		// Case 3: Parla MCP Tools are active
		if (isParlaMCPToolActive) {
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
