// @ts-expect-error k6 imports this library from a CDN
import { expect } from "https://jslib.k6.io/k6-testing/0.5.0/index.js";
// @ts-expect-error k6 imports this library from a CDN
import { FormData } from "https://jslib.k6.io/formdata/0.0.2/index.js";
import http, { FileData } from "k6/http";
// @ts-expect-error k6 needs the .ts extension
import { API_URL } from "./constants.ts";
// @ts-expect-error k6 needs the .ts extension
import { Session } from "./log-in.ts";

export function uploadDocument({
	file,
	filePath,
	session,
}: {
	file: FileData;
	filePath: string;
	session?: Session;
}) {
	expect(session).toBeDefined();

	const form = new FormData();
	form.append("file", file, file.filename);
	form.append("sourceUrl", filePath);

	const headers = {
		"Content-Type": form.contentType,
		Authorization: `Bearer ${session.access_token}`,
	};

	return http.post(`${API_URL}/documents/upload`, form.body(), {
		headers,
	});
}
