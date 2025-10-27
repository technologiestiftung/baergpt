// @ts-expect-error k6 imports this library from a CDN
import { expect } from "https://jslib.k6.io/k6-testing/0.5.0/index.js";
import http from "k6/http";
// @ts-expect-error k6 needs the .ts extension
import { type Session } from "./log-in.ts";
// @ts-expect-error k6 needs the .ts extension
import { API_URL } from "./constants.ts";

export function getInference({
	session,
	chat_id,
	allowed_document_ids,
	content,
}: {
	session?: Session;
	chat_id?: number;
	allowed_document_ids?: number[];
	content?: string;
}) {
	expect(session).toBeDefined();

	const headers = {
		"Content-Type": "application/json",
		Authorization: `Bearer ${session.access_token}`,
	};

	const payload = JSON.stringify({
		messages: [{ role: "user", content }],
		user_id: session.user.id,
		chat_id,
		search_type: "all_private",
		allowed_document_ids,
		allowed_folder_ids: [],
		is_addressed_formal: true,
	});

	return http.post(`${API_URL}/llm/just-chatting`, payload, {
		headers,
	});
}
