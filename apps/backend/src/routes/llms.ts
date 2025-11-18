import { Hono } from "hono";
import type { Context } from "hono";
import type { ChatMessageBody } from "../types/common";
import type { ModelMessage } from "ai";
import { ModelService } from "../services/model-service";
import { GenerationService } from "../services/generation-service";
import { config } from "../config";
import { captureError } from "../monitoring/capture-error";

const llms = new Hono();
const modelService = new ModelService();
const generationService = new GenerationService();

llms.post("/just-chatting", async (c: Context) => {
	try {
		const body = (await c.req.json()) as ChatMessageBody;
		const llmIdentifier = config.defaultModelIdentifier;
		const llmHandler = modelService.resolveLlmHandler(llmIdentifier);
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

		const { messages: promptMessages, promptClient: langfusePrompt } =
			await generationService.createPrompt(messages, isAddressedFormal);
		const response = await generationService.generateTextStreamResponse(
			llmHandler,
			promptMessages,
			{
				userId: body.user_id,
				sessionId: body.chat_id,
				langfusePrompt: langfusePrompt,
				allowedDocumentIds: allowedDocumentIds,
				allowedFolderIds: allowedFolderIds,
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
