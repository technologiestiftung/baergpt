import { enc } from "../constants";
import { config } from "../config";
import { isLoopFinished, ModelMessage, Tool, ToolChoice } from "ai";
import {
	createUIMessageStream,
	createUIMessageStreamResponse,
	generateText,
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
import { ragSearchTool } from "../tools/rag-search-tool";
import { parlaMCPTools } from "../tools/mcp/parla-mcp-tools";
import { webSearchTool } from "../tools/web-search";
import { captureError } from "../monitoring/capture-error";
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

		/**
		 * Sometimes the frontend might send empty assistant messages (e.g. as placeholders for streaming responses),
		 * so we filter those out to avoid confusing the LLM.
		 */
		const isEmptyAssistantMessage = ({ role, content }: ModelMessage) =>
			!(
				role === "assistant" &&
				typeof content === "string" &&
				content.trim() === ""
			);
		const filteredMessages = messages.filter(isEmptyAssistantMessage);

		updateActiveTrace({ input: messages[messages.length - 1].content });

		const stream = createUIMessageStream({
			execute: async ({ writer }) => {
				const streamResponse = await resilientCall(
					async () =>
						streamText({
							model: llmHandler.languageModel,
							messages: filteredMessages,
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
							onFinish: async ({ text, usage }) => {
								logMemory(
									`chat:onFinish (textLen=${text.length}, tokens=${usage?.totalTokens ?? 0})`,
									reqId,
								);
								if (typeof toolsCleanup === "function") {
									await toolsCleanup();
								}

								updateActiveTrace({
									name: "streamed-text-generation",
									output: text,
									userId,
									sessionId,
								});

								if (userId && usage?.totalTokens) {
									try {
										await this.dbService.updateUserColumnValue(
											userId,
											"num_inference_tokens",
											usage.totalTokens,
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
							},
							experimental_telemetry: {
								isEnabled:
									config.nodeEnv !== "test" && config.nodeEnv !== "production",
								functionId: "text-toolCall-generation",
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

		try {
			freeChatPromptClient = await langfuse.prompt.get(
				"free-chat-with-web-search-enabled",
				{ label: config.nodeEnv === "test" ? "development" : config.nodeEnv },
			);
		} catch (error) {
			captureError(error);
			throw error;
		}

		const compiledFreeChatPrompt = freeChatPromptClient.compile({
			currentDate: currentDate,
			addressForm: addressForm,
		});
		const freeChatPrompt: ModelMessage = {
			role: "system",
			content: compiledFreeChatPrompt,
		};

		freeChatPrompt.content += `

Du analysierst eine generierte Antwort und die verfügbaren Quellen.
FÜGE ZITATE NUR HINZU, WENN DU ZITATE EINDEUTIG DOKUMENTEN ZUORDNEN KANNST.
Füge die Zitate im Markdown Footnote Format ein, also so: [^1], [^2], [^3], etc. OHNE Sprünge.
Platziere die Zitatverweise NACH dem Ende des jeweiligen Satzes.
IMMER UND NUR AM ENDE der Antwort listest du die Quellen in der Reihenfolge ihrer Nummerierung auf, ebenfalls im Markdown Footnote Format, also so:
\`\`\`
Quellen:
[^<FOOTNOTE_REFERENCE_NUMBER>]: [<documentTitle>,  Seite <page>](<sourceUrl>)
\`\`\`
	`;

		const messages = [freeChatPrompt, ...previousMessages];

		// console.log(messages);

		return {
			messages,
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

		if (
			config.featureFlagMcpParlaAllowed &&
			activeTools.includes("parlaMCPTools")
		) {
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
