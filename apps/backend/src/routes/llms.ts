import { Hono } from "hono";
import type { Context } from "hono";
import { config } from "../config";
import type { ActiveTools, ChatMessageBody } from "../types/common";
import type { ModelMessage } from "ai";

const VALID_ACTIVE_TOOLS = new Set<ActiveTools>([
	"baseKnowledgeSearchTool",
	"ragSearchTool",
	"webSearchTool",
	"parlaMCPTools",
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
		const messages = body.messages as ModelMessage[];
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

		const hasAttachedDocuments =
			allowedDocumentIds.length > 0 || allowedFolderIds.length > 0;
		const { messages: promptMessages, promptClient: langfusePrompt } =
			await generationService.createPrompt(
				messages,
				isAddressedFormal,
				activeTools,
				hasAttachedDocuments,
			);
		const response = await generationService.generateTextStreamResponse(
			llmHandler,
			promptMessages,
			{
				userId: body.user_id,
				sessionId: body.chat_id,
				langfusePrompt: langfusePrompt,
				allowedDocumentIds: allowedDocumentIds,
				allowedFolderIds: allowedFolderIds,
				activeTools,
			},
		);

		response.headers.set("Content-Type", "text/event-stream; charset=utf-8");
		response.headers.set("Transfer-Encoding", "chunked");
		return response;
	} catch (error) {
		captureError(error);
		return c.json({ error: "Internal Server Error" }, 500);
	}
});

export default llms;
