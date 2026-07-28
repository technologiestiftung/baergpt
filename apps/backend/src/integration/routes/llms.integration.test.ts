import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@repo/db-schema";
import app from "../../index";
import { config } from "../../config";
import { serviceRoleDbClient } from "../../supabase";
import { EXTERNAL_TOOLS } from "../../routes/llms";
import type { ActiveTools } from "../../types/common";

const supabaseAnonClient = createClient<Database>(
	config.supabaseUrl,
	config.supabaseAnonKey,
);

const USER_ID = "c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3";
const USER_EMAIL = "llm-tools-validation-test@ts.berlin";
const USER_PASSWORD = "SecurePassword789!";

// feature-flagged. Pick the first enabled tool, if any.
const externalToolEnabled: Partial<Record<ActiveTools, boolean>> = {
	webSearchTool: config.featureFlagWebSearchAllowed,
	parlaMCPTools: config.featureFlagMcpParlaAllowed,
	openDataMCPTools: config.featureFlagMcpOpenDataAllowed,
	datawrapperMCPTools: config.featureFlagMcpDatawrapperAllowed,
};
const enabledExternalTool =
	[...EXTERNAL_TOOLS].find((tool) => externalToolEnabled[tool]) ?? null;

let userToken: string;

async function postJustChatting(body: unknown) {
	return app.request("/llm/just-chatting", {
		method: "POST",
		body: JSON.stringify(body),
		headers: new Headers({
			"Content-Type": "application/json",
			authorization: `Bearer ${userToken}`,
		}),
	});
}

describe("POST /llm/just-chatting active_tools validation", () => {
	beforeAll(async () => {
		await serviceRoleDbClient.auth.admin.deleteUser(USER_ID).catch(() => {});

		await serviceRoleDbClient.auth.admin.createUser({
			id: USER_ID,
			email: USER_EMAIL,
			password: USER_PASSWORD,
			email_confirm: true,
		});

		const session = await supabaseAnonClient.auth.signInWithPassword({
			email: USER_EMAIL,
			password: USER_PASSWORD,
		});
		userToken = session.data.session?.access_token || "";
	}, 30_000);

	afterAll(async () => {
		await serviceRoleDbClient.auth.admin.deleteUser(USER_ID).catch(() => {});
	});

	it("rejects unknown tool names with 400", async () => {
		const res = await postJustChatting({
			llm_model: "mistral-small",
			messages: [{ role: "user", content: "hallo" }],
			active_tools: ["notARealTool"],
		});

		expect(res.status).toBe(400);
		const responseBody = await res.json();
		expect(responseBody.error).toContain("valid tool names");
	});

	// Runs only when an external tool is enabled in this environment; the rule is
	// unreachable otherwise (the tool would be rejected as invalid first).
	it.runIf(enabledExternalTool !== null)(
		"rejects combining document/folder search with an external tool (400)",
		async () => {
			const res = await postJustChatting({
				llm_model: "mistral-small",
				messages: [{ role: "user", content: "hallo" }],
				active_tools: [enabledExternalTool],
				allowed_document_ids: [1],
			});

			expect(res.status).toBe(400);
			const responseBody = await res.json();
			expect(responseBody.error).toContain(
				"cannot be combined with external tools",
			);
		},
	);
});
