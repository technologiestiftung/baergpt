import { LangfuseClient } from "@langfuse/client";
import type { ChatMessage } from "@langfuse/core";
import { config } from "../config";
import { mockChatPrompt, mockTextPrompt } from "./external-mocks";

/**
 * Central access point for Langfuse prompts. In `test` mode it returns static
 * fallback prompt clients (see external-mocks.ts) so the suite never calls the
 * Langfuse API; otherwise it delegates to the real client.
 *
 * IMPORTANT: if you want the test mode locally, you need to put
 *            NODE_ENV=test in your backend .env file. Also when
 *            you want to use a backend in test mode for e2e tests.
 */

const isTestMode = config.nodeEnv === "test";

const langfuse = new LangfuseClient();

type BasePromptOptions = {
	label?: string;
	version?: number;
	cacheTtlSeconds?: number;
	maxRetries?: number;
};

/**
 * Fetches a "text" Langfuse prompt: a single template string.
 * `compile()` returns that string with its variables filled in.
 */
export async function getTextPrompt(
	name: string,
	options?: BasePromptOptions & { fallback?: string },
) {
	if (isTestMode) {
		return mockTextPrompt(name);
	}

	return langfuse.prompt.get(name, { ...options, type: "text" });
}

/**
 * Fetches a "chat" Langfuse prompt. "Chat" refers to the prompt format —
 * an array of role-tagged messages (system + user) — not an end-user
 * conversation. We use it for self-contained, one-shot backend inferences
 * like summaries or tagging because it improves instruction-following.
 */
export async function getChatPrompt(
	name: string,
	options?: BasePromptOptions & { fallback?: ChatMessage[] },
) {
	if (isTestMode) {
		return mockChatPrompt(name);
	}

	return langfuse.prompt.get(name, { ...options, type: "chat" });
}
