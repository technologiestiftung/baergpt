// @ts-expect-error k6 imports this library from a CDN
import { expect } from "https://jslib.k6.io/k6-testing/0.5.0/index.js";
import http, { type FileData } from "k6/http";
// @ts-expect-error k6 needs the .ts extension
import { API_URL } from "./constants.ts";
// @ts-expect-error k6 needs the .ts extension
import { Session } from "./log-in.ts";

export function processDocument({
	file,
	filePath,
	session,
}: {
	file: FileData;
	filePath: string;
	session?: Session;
}) {
	expect(session).toBeDefined();

	const headers = {
		"Content-Type": "multipart/form-data",
		Authorization: `Bearer ${session.access_token}`,
	};

	const metadata = JSON.stringify({
		document: {
			id: null,
			file_name: file.filename,
			folder_id: null,
			owned_by_user_id: session?.user.id,
			created_at: new Date().toISOString(),
			source_type: "personal_document",
			source_url: filePath,
			metadata: {
				mimeType: file.content_type,
				size: (file.data as ArrayBuffer).byteLength,
			},
		},
	});

	return http.post(`${API_URL}/documents/process`, metadata, {
		headers,
	});
}
