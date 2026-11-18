import { Hono } from "hono";
import type { Context } from "hono";
import { config } from "../config";
import {
	REASONING_EFFORTS,
	type ActiveTools,
	type ChatMessageBody,
	type ReasoningEffort,
} from "../types/common";

function isValidReasoningEffort(value: unknown): value is ReasoningEffort {
	return REASONING_EFFORTS.includes(value as ReasoningEffort);
}

/**
 * `reasoning_effort` wins over the legacy `extended_thinking` flag of older
 * clients, where `true` means "high".
 */
function parseReasoningEffort(
	body: Pick<ChatMessageBody, "extended_thinking" | "reasoning_effort">,
): { reasoningEffort: ReasoningEffort } | { error: string } {
	const legacyExtendedThinking = body.extended_thinking ?? false;
	if (typeof legacyExtendedThinking !== "boolean") {
		return { error: "Invalid request: extended_thinking must be a boolean" };
	}

	const reasoningEffort: unknown =
		body.reasoning_effort ?? (legacyExtendedThinking ? "high" : "none");
	if (!isValidReasoningEffort(reasoningEffort)) {
		return {
			error: `Invalid request: reasoning_effort must be one of ${REASONING_EFFORTS.join(", ")}`,
		};
	}

	return { reasoningEffort };
}

const VALID_ACTIVE_TOOLS = new Set<ActiveTools>([
	"ragSearchTool",
	"webSearchTool",
	"parlaMCPTools",
	"datawrapperMCPTools",
	"openDataMCPTools",
]);

export const EXTERNAL_TOOLS = new Set<ActiveTools>([
	"webSearchTool",
	"parlaMCPTools",
	"datawrapperMCPTools",
	"openDataMCPTools",
]);

function isValidActiveTool(value: unknown): value is ActiveTools {
	if (
		typeof value !== "string" ||
		!VALID_ACTIVE_TOOLS.has(value as ActiveTools)
	) {
		return false;
	}

	if (value === "webSearchTool" && !config.featureFlagWebSearchAllowed) {
		return false;
	}

	if (value === "parlaMCPTools" && !config.featureFlagMcpParlaAllowed) {
		return false;
	}

	if (value === "openDataMCPTools" && !config.featureFlagMcpOpenDataAllowed) {
		return false;
	}

	if (
		value === "datawrapperMCPTools" &&
		!config.featureFlagMcpDatawrapperAllowed
	) {
		return false;
	}

	return true;
}
import { ModelService } from "../services/model-service";
import { GenerationService } from "../services/generation-service";
import { captureError } from "../monitoring/capture-error";
import { UserScopedDbService } from "../services/db-service/user-scoped-db-service";

const llms = new Hono();
const modelService = new ModelService();
llms.post("/just-chatting", async (c: Context) => {
	const userClient = c.get("UserScopedDbClient");
	const userScopedDbService = new UserScopedDbService(userClient);
	const generationService = new GenerationService(userScopedDbService);
	try {
		const body = (await c.req.json()) as ChatMessageBody;
		const llmModelName = body.llm_model;
		if (!llmModelName || typeof llmModelName !== "string") {
			return c.json(
				{
					error: "Invalid request: llm_model is required and must be a string",
				},
				400,
			);
		}
		const llmHandler = modelService.resolveLlmHandler(llmModelName);
		const allowedDocumentIds = body.allowed_document_ids || [];
		const allowedFolderIds = body.allowed_folder_ids || [];
		const messages = body.messages;
		const isAddressedFormal = body.is_addressed_formal;
		if (messages.length === 0 || !messages.at(-1)?.content) {
			return c.json(
				{
					error:
						"Invalid request: empty messages array or last message has no content",
				},
				400,
			);
		}

		const reasoning = parseReasoningEffort(body);
		if ("error" in reasoning) {
			return c.json({ error: reasoning.error }, 400);
		}
		const { reasoningEffort } = reasoning;

		const rawActiveTools = body.active_tools ?? [];

		if (
			!Array.isArray(rawActiveTools) ||
			!rawActiveTools.every(isValidActiveTool)
		) {
			return c.json(
				{
					error: `Invalid request: active_tools must be an array of valid tool names (${[...VALID_ACTIVE_TOOLS].join(", ")})`,
				},
				400,
			);
		}
		const activeTools: ActiveTools[] = rawActiveTools;

		const hasSelectedDocuments =
			allowedDocumentIds.length > 0 || allowedFolderIds.length > 0;
		const isExternalToolActive = activeTools.some((tool) =>
			EXTERNAL_TOOLS.has(tool),
		);
		if (hasSelectedDocuments && isExternalToolActive) {
			return c.json(
				{
					error:
						"Invalid request: document/folder search cannot be combined with external tools.",
				},
				400,
			);
		}

		if (hasSelectedDocuments) {
			activeTools.push("ragSearchTool");
		}

		const authenticatedUserId = c.get("authenticatedUserId");
		if (!authenticatedUserId) {
			return c.json({ error: "Unauthorized" }, 401);
		}
		let userSystemPrompt: string | null = null;
		userSystemPrompt =
			await userScopedDbService.getPersonalSystemPrompt(authenticatedUserId);

		const { messages: promptMessages, promptClient: langfusePrompt } =
			await generationService.createPrompt({
				previousMessages: messages,
				isAddressedFormal,
				activeTools,
				userSystemPrompt,
				isExternalToolActive,
			});
		const response = await generationService.generateTextStreamResponse({
			llmHandler,
			messages: promptMessages,
			userId: authenticatedUserId,
			sessionId: String(body.chat_id),
			langfusePrompt: langfusePrompt,
			allowedDocumentIds: allowedDocumentIds,
			allowedFolderIds: allowedFolderIds,
			activeTools,
			reasoningEffort,
		});

		response.headers.set("Content-Type", "text/event-stream; charset=utf-8");
		response.headers.set("Transfer-Encoding", "chunked");
		return response;
	} catch (error) {
		captureError(error);
		return c.json({ error: "Internal Server Error" }, 500);
	}
});

export default llms;
