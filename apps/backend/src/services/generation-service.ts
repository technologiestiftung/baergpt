import { enc, ragSearchDefaults } from "../constants";
import { config } from "../config";
import type { ModelMessage, Tool, ToolChoice } from "ai";
import { generateText, streamObject } from "ai";
import { ModelService } from "./model-service";
import { EmbeddingService } from "./embedding-service";
import type { ChatPromptClient, TextPromptClient } from "langfuse";
import { Langfuse } from "langfuse";
import {
	type Document,
	type HybridSearchResult,
	type KnowledgeBaseDocument,
	type LLMHandler,
} from "../types/common";
import { DatabaseService } from "./database-service";
import { LLM_PARAMETERS } from "../constants";
import type { LLMIdentifier, ParsedPage } from "../types/common";
import { baseKnowledgeSearchTool } from "../tools/base-knowledge-search-tool";
import { ragSearchTool } from "../tools/rag-search-tool";
import { captureError } from "../monitoring/capture-error";
import { z } from "zod";
import { citationAnswerSchema } from "../schemas/citation-answer-schema";

const ESTIMATED_TOKENS_PER_WORD = config.estimatedTokensPerWord;
const langfuse = new Langfuse();
const modelService = new ModelService();
const dbService = new DatabaseService();
const embeddingService = new EmbeddingService();

interface BuildContextFromDocumentsParams {
	chunkMatches: HybridSearchResult[];
	summaries: string[];
}

const maxAvailableSources = ragSearchDefaults.chunk_limit;

export class GenerationService {
	async generateSummary(
		llmIdentifier: LLMIdentifier,
		docInput: string | ParsedPage[],
		{
			oneSentenceSummary = false,
			userId,
		}: { oneSentenceSummary?: boolean; userId?: string } = {},
	): Promise<string | null> {
		const llmHandler = modelService.resolveLlmHandler(llmIdentifier);
		let compiledSummaryPrompt: ModelMessage[];
		let summaryPromptClient: ChatPromptClient;

		const docContent =
			typeof docInput === "string"
				? docInput
				: docInput.map((page) => page.content).join("\n");

		if (oneSentenceSummary) {
			summaryPromptClient = await langfuse.getPrompt(
				"one-sentence-summary",
				undefined,
				{
					label: config.nodeEnv === "test" ? "development" : config.nodeEnv,
					type: "chat",
				},
			);
			compiledSummaryPrompt = summaryPromptClient.compile({
				docContent: docContent,
			}) as ModelMessage[];
		} else {
			summaryPromptClient = await langfuse.getPrompt("summary", undefined, {
				label: config.nodeEnv === "test" ? "development" : config.nodeEnv,
				type: "chat",
			});
			compiledSummaryPrompt = summaryPromptClient.compile({
				docContent: docContent,
			}) as ModelMessage[];
		}

		try {
			const response: string = await this.generateTextContent(
				llmHandler,
				compiledSummaryPrompt,
				{ userId, langfusePrompt: summaryPromptClient },
			);
			return response;
		} catch (error) {
			captureError(error);
			return null;
		}
	}

	async generateSummaryForLargeDocument(
		llmIdentifier: LLMIdentifier,
		completeDoc: string | ParsedPage[],
		{
			allSummaries = [],
			userId,
		}: { allSummaries?: string[]; userId?: string } = {},
	): Promise<string | null> {
		const modelContextSize =
			modelService.availableModels[llmIdentifier].contextSize;
		const MAX_TOKEN_COUNT_FOR_SUMMARY = modelContextSize - 1000;

		const completeDocument =
			typeof completeDoc === "string"
				? completeDoc
				: completeDoc.map((page) => page.content).join("\n");

		const maxTokenChunks = this.splitInChunksAccordingToTokenLimit(
			completeDocument,
			MAX_TOKEN_COUNT_FOR_SUMMARY,
			0,
		);

		// Generate summaries in batches (to avoid 429)
		const batches = this.splitArrayEqually(maxTokenChunks, 10);
		let summaries: string[] = [];

		try {
			for (let idx = 0; idx < batches.length; idx++) {
				const batch = batches[idx];
				const batchSummaries = await Promise.all(
					batch.map(async (chunk) => {
						const summary = await this.generateSummary(llmIdentifier, chunk, {
							userId,
						});
						return summary;
					}),
				);

				// Filter out null values before adding to summaries array
				const validSummaries = batchSummaries.filter(
					(s): s is string => s !== null,
				);

				if (validSummaries.length === 0) {
					console.warn(`Batch ${idx} produced no valid summaries`);
					continue;
				}

				summaries = summaries.concat(validSummaries);
			}

			if (summaries.length === 0) {
				captureError(
					new Error(
						"Failed to generate any valid summaries for document chunks",
					),
				);
				return null;
			}

			const totalSummary = summaries.join("\n");
			const totalSummaryTokens =
				totalSummary.split(/\s+/).length * ESTIMATED_TOKENS_PER_WORD;
			const combinedSummaries = allSummaries.concat(summaries);

			if (totalSummaryTokens > MAX_TOKEN_COUNT_FOR_SUMMARY) {
				return this.generateSummaryForLargeDocument(
					llmIdentifier,
					totalSummary,
					{
						allSummaries: combinedSummaries,
						userId,
					},
				);
			}

			const finalSummary = await this.generateSummary(
				llmIdentifier,
				totalSummary,
			);
			return finalSummary;
		} catch (error) {
			captureError(error);
			return null;
		}
	}

	async generateTags(
		llmIdentifier: LLMIdentifier,
		docInput: string | ParsedPage[],
		{ userId }: { userId?: string } = {},
	): Promise<string[] | null> {
		const llmHandler = modelService.resolveLlmHandler(llmIdentifier);
		const docContent =
			typeof docInput === "string"
				? docInput
				: docInput.map((page) => page.content).join("\n");

		const taggingPromptClient = await langfuse.getPrompt("tagging", undefined, {
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
		llmIdentifier: LLMIdentifier,
		document: Document,
	): Promise<void> {
		const content = parsedPages.map((page) => page.content).join("\n");
		const numTokens = content.split(/\s+/).length * ESTIMATED_TOKENS_PER_WORD;
		let summary: string | null = null;
		const MAX_TOKEN_COUNT_FOR_SUMMARY =
			modelService.availableModels[llmIdentifier].contextSize;
		const userId = document.owned_by_user_id || document.uploaded_by_user_id;

		if (numTokens > MAX_TOKEN_COUNT_FOR_SUMMARY) {
			summary = await this.generateSummaryForLargeDocument(
				llmIdentifier,
				parsedPages,
				{ userId },
			);
		} else {
			summary = await this.generateSummary(llmIdentifier, parsedPages, {
				userId,
			});
		}

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

		const summaryEmbeddingResponse =
			await embeddingService.generateJinaEmbedding(
				summary,
				"retrieval.passage",
				userId,
			);
		if (!summaryEmbeddingResponse || !summaryEmbeddingResponse.embedding) {
			throw new Error("Failed to generate document embedding");
		}

		const tags = await this.generateTags(llmIdentifier, parsedPages, {
			userId,
		});
		if (!tags) {
			throw new Error("Failed to generate document tags");
		}

		// Using the refactored function with structured parameters
		await dbService.logSummarizedDocument(
			{
				summary,
				shortSummary,
				tags,
				summaryEmbedding: summaryEmbeddingResponse.embedding,
			},
			document,
		);
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
		}: {
			userId?: string;
			sessionId?: string;
			langfusePrompt?: TextPromptClient | ChatPromptClient;
			allowedDocumentIds?: number[];
			allowedFolderIds?: number[];
		} = {},
	): Promise<Response> {
		let knowledgeBaseDocuments: KnowledgeBaseDocument[];
		let tools: Record<string, Tool>;
		let toolChoice: ToolChoice<Record<string, unknown>>;

		const hasAllowedDocumentsOrFolders =
			allowedDocumentIds.length > 0 || allowedFolderIds.length > 0;

		if (hasAllowedDocumentsOrFolders) {
			tools = {
				ragSearchTool: ragSearchTool(
					userId,
					allowedDocumentIds,
					allowedFolderIds,
				),
			};
			toolChoice = { type: "tool", toolName: "ragSearchTool" };
		} else {
			knowledgeBaseDocuments =
				await dbService.getBaseKnowledgeDocuments(userId);
			tools = {
				baseKnowledgeSearchTool: baseKnowledgeSearchTool(
					userId,
					knowledgeBaseDocuments,
				),
			};
			toolChoice = "auto";
		}
		const generationResult = await generateText({
			model: llmHandler.languageModel,
			messages: messages,
			temperature: LLM_PARAMETERS.temperature,
			tools,
			toolChoice,
			experimental_telemetry: {
				isEnabled: !process.env.CI, // Disable telemetry in CI
				metadata: {
					userId: userId ? userId : "unknown",
					sessionId: sessionId ? sessionId : "unknown",
					langfusePrompt: langfusePrompt ? langfusePrompt.toJSON() : undefined,
				},
			},
		});
		if (userId && generationResult.usage?.totalTokens) {
			try {
				await dbService.updateUserColumnValue(
					userId,
					"num_inference_tokens",
					generationResult.usage.totalTokens,
				);
				await dbService.updateUserColumnValue(userId, "num_inferences", 1);
			} catch (error) {
				captureError(error);
			}
		}
		const toolResult = generationResult.toolResults[0];
		const newMessages = generationResult.response.messages;

		if (toolResult) {
			messages.push(...newMessages);
		}

		const citationAnswer = streamObject({
			model: llmHandler.languageModel,
			messages: messages,
			temperature: LLM_PARAMETERS.temperature,
			// @ts-expect-error after the migration to the monorepo and unifying ai-sdk package versions across the monorepo
			//  the types were suddenly incompatible, even though the logic has not changed, and it is working as before.
			//  I was not able to fix it in a reasonable time, maybe we can look into this later.
			schema: citationAnswerSchema(maxAvailableSources),
			onFinish: async ({ usage, error }) => {
				// Handle token usage tracking after stream completes
				if (userId && usage?.totalTokens) {
					try {
						await dbService.updateUserColumnValue(
							userId,
							"num_inference_tokens",
							usage.totalTokens,
						);
						// Increase num_inferences for user by one
						await dbService.updateUserColumnValue(userId, "num_inferences", 1);
					} catch (dbError) {
						captureError(dbError);
					}
					if (error) {
						captureError(error);
					}
				}
			},
			experimental_telemetry: {
				isEnabled: !process.env.CI, // Disable telemetry in CI
				metadata: {
					userId: userId ? userId : "unknown",
					sessionId: sessionId ? sessionId : "unknown",
					langfusePrompt: langfusePrompt ? langfusePrompt.toJSON() : undefined,
				},
			},
			onError: (error) => {
				captureError(error);
			},
		});

		const response = citationAnswer.toTextStreamResponse();

		return response;
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
		const { text, usage } = await generateText({
			model: llmHandler.languageModel,
			messages: messages,
			temperature: LLM_PARAMETERS.temperature,
			experimental_telemetry: {
				isEnabled: !(process.env.CI || !userId), // Disable telemetry in CI and when userId is not provided
				metadata: {
					userId: userId ? userId : "unknown",
					sessionId: sessionId ? sessionId : "unknown",
					langfusePrompt: langfusePrompt ? langfusePrompt.toJSON() : undefined,
				},
			},
		});
		if (userId) {
			// Increase num_inferences for user by 1
			await dbService.updateUserColumnValue(userId, "num_inferences", 1);
			// Increase num_tokens by token count of this generation
			await dbService.updateUserColumnValue(
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
	 * Processes document chunks to build context for the prompt
	 */

	buildContextFromDocuments({
		chunkMatches,
		summaries,
	}: BuildContextFromDocumentsParams): string {
		const LIMIT = config.chatCompletionContextTokenLimit;
		let context = "";

		for (const summary of summaries) {
			if (
				(context + summary).split(/\s+/).length * ESTIMATED_TOKENS_PER_WORD <
				LIMIT
			) {
				context += summary;
			}
		}

		context += "\n\nZitate aus verfügbaren Dokumenten:\n\n";

		for (const chunkMatch of chunkMatches) {
			const chunk = chunkMatch.chunk_content;
			if (
				`${context + chunk}\n`.split(/\s+/).length * ESTIMATED_TOKENS_PER_WORD <
				LIMIT
			) {
				context += `${chunk}\n`;
			}
		}

		return context;
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
		const freeChatPromptClient = await langfuse.getPrompt(
			"free-chat",
			undefined,
			{ label: config.nodeEnv === "test" ? "development" : config.nodeEnv }, // Fallback to development prompt version during tests
		);
		const compiledFreeChatPrompt = freeChatPromptClient.compile({
			currentDate: currentDate,
			addressForm: addressForm,
			citationSchema: JSON.stringify(
				z.toJSONSchema(citationAnswerSchema(maxAvailableSources)),
			),
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
}
