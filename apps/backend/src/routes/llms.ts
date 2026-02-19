import { Hono } from "hono";
import type { Context } from "hono";
import type { ChatMessageBody } from "../types/common";
import type { ModelMessage } from "ai";
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
		const isBaseKnowledgeActive = body.is_base_knowledge_active;
		const isParlaMCPToolActive = body.is_parla_mcp_tool_active;
		const messageId = body.message_id;
		if (messages.length === 0 || !messages.at(-1)?.content) {
			return c.json(
				{
					error:
						"Invalid request: empty messages array or last message has no content",
				},
				400,
			);
		}

		const { messages: promptMessages, promptClient: langfusePrompt } =
			await generationService.createPrompt(messages, isAddressedFormal);
		const response = await generationService.generateTextStreamResponse(
			llmHandler,
			promptMessages,
			{
				userId: body.user_id,
				sessionId: body.chat_id,
				messageId: messageId,
				langfusePrompt: langfusePrompt,
				allowedDocumentIds: allowedDocumentIds,
				allowedFolderIds: allowedFolderIds,
				isBaseKnowledgeActive: isBaseKnowledgeActive,
				isParlaMCPToolActive: isParlaMCPToolActive,
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
