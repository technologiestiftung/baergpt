import { describe, it, expect } from "vitest";
import { GenerationService } from "../services/generation-service";
import type { BaseContentDbService } from "../services/db-service/base-db-service";
import type { IncomingChatMessage } from "../types/common";

const mockDbService = {} as unknown as BaseContentDbService;
const generationService = new GenerationService(mockDbService);

// A conversation with confidential content in non-tool messages, then an external tool
// is activated. The last message is the current turn.
const history: IncomingChatMessage[] = [
	{
		role: "user",
		content: "Vertraulich: internes Budget 4,2 Mio EUR",
		external_tool_context: false,
	},
	{ role: "assistant", content: "Notiert.", external_tool_context: false },
	{
		role: "user",
		content: "Suche im Web nach Berliner Förderfristen",
		external_tool_context: true,
	},
	{
		role: "assistant",
		content: "Die Frist ist der 15. März.",
		external_tool_context: true,
	},
	{ role: "user", content: "Und neuere?" },
];

// Drop the injected system prompt at index 0; keep the scoped conversation.
const scopedContents = (messages: { content: unknown }[]) =>
	messages.slice(1).map(({ content }) => content);

describe("createPrompt external-tool context scoping", () => {
	it("keeps only external-tool messages plus the current message when an external tool is active", async () => {
		const { messages } = await generationService.createPrompt({
			previousMessages: history,
			isAddressedFormal: true,
			activeTools: ["webSearchTool"],
			isExternalToolActive: true,
		});

		expect(messages[0].role).toBe("system");
		expect(scopedContents(messages)).toEqual([
			"Suche im Web nach Berliner Förderfristen",
			"Die Frist ist der 15. März.",
			"Und neuere?",
		]);
	});

	it("passes the full history through unchanged when no external tool is active", async () => {
		const { messages } = await generationService.createPrompt({
			previousMessages: history,
			isAddressedFormal: true,
			activeTools: [],
			isExternalToolActive: false,
		});

		expect(scopedContents(messages)).toEqual(
			history.map(({ content }) => content),
		);
	});
});
