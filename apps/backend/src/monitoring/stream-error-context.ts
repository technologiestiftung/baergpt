import { RetryError, ToolChoiceViolationError, type LanguageModel } from "ai";
import type { ActiveTools } from "../types/common";
import type { ErrorContext } from "./capture-error";

type StreamErrorRequest = {
	chatId: string;
	model: string;
	languageModel: LanguageModel;
	extendedThinking: boolean;
	activeTools: ActiveTools[];
};

/** Bugsink tags and full error JSON for a chat stream error. */
export function getStreamErrorContext(
	error: unknown,
	request: StreamErrorRequest,
): ErrorContext {
	const tags: Record<string, string> = {
		chatId: request.chatId,
		model: request.model,
		modelId: getModelId(request.languageModel),
		extendedThinking: String(request.extendedThinking),
		activeTools: request.activeTools.join(",") || "none",
		errorName: error instanceof Error ? error.name : typeof error,
	};

	const statusCode = getStatusCode(error);
	if (statusCode !== undefined) {
		tags.statusCode = String(statusCode);
	}

	const toolName = getViolatingToolName(error);
	if (toolName) {
		tags.toolName = toolName;
	}

	return { tags, extra: { errorDetails: stringifyErrorFields(error) } };
}

function getModelId(languageModel: LanguageModel): string {
	return typeof languageModel === "string"
		? languageModel
		: languageModel.modelId;
}

/** HTTP status of an API error; for a RetryError from its last attempt. */
function getStatusCode(error: unknown): number | undefined {
	const source = RetryError.isInstance(error) ? error.lastError : error;
	if (typeof source !== "object" || source === null) {
		return undefined;
	}
	const { statusCode } = source as { statusCode?: unknown };
	return typeof statusCode === "number" ? statusCode : undefined;
}

/** The tool the model called although tools were switched off. */
function getViolatingToolName(error: unknown): string | undefined {
	if (!ToolChoiceViolationError.isInstance(error)) {
		return undefined;
	}
	const toolCall = error.content.find(({ type }) => type === "tool-call");
	return toolCall?.type === "tool-call" ? toolCall.toolName : undefined;
}

function stringifyErrorFields(error: unknown): string {
	try {
		return JSON.stringify(error) ?? String(error);
	} catch {
		return String(error);
	}
}
