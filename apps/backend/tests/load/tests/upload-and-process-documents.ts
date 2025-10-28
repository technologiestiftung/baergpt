// @ts-expect-error k6 needs the .ts extension
import { logIn } from "../fixtures/log-in.ts";
// @ts-expect-error k6 imports this library from a CDN
import slugify from "https://raw.githubusercontent.com/simov/slugify/refs/heads/master/slugify.js";
import http from "k6/http";
import { check, sleep } from "k6";
// @ts-expect-error k6 needs the .ts extension
import { LogInResponse } from "../fixtures/log-in.ts";
// @ts-expect-error k6 needs the .ts extension
import { uploadDocument } from "../fixtures/upload-document.ts";
// @ts-expect-error k6 needs the .ts extension
import { processDocument } from "../fixtures/process-document.ts";
// @ts-expect-error k6 needs the .ts extension
import { email, getFileName, password } from "../fixtures/constants.ts";
import { Counter } from "k6/metrics";

export const options = {
	// todo: enable / disable the tests types by commenting / uncommenting

	/**
	 * Smoke Test
	 */
	// vus: 1,
	// duration: "10s",

	/**
	 * Spike Test
	 */
	 stages: [
	 	{ duration: "2m", target: 100 }, // fast ramp-up to a high point
	// 	// No plateau
	 	{ duration: "1m", target: 0 }, // quick ramp-down to 0 users
	 ],

	/**
	 * Stress Test
	 *  todo: the target here is definitely too high
	 */
	// stages: [
	// 	{ duration: "5m", target: 30 }, // traffic ramp-up from 1 to a higher 200 users over 10 minutes.
	// 	{ duration: "5m", target: 70 }, // stay at higher 200 users for 30 minutes
	// 	{ duration: "5m", target: 0 }, // ramp-down to 0 users
	// ],
};

/**
 * todo: you can only use the `open` function in the global scope, outside of the test and setup functions
 *   We should probably load ALL files here, and then just pick one in each iteration
 *   (based on the `__ITER` variable, e.g. with getFileName(__ITER) )
 */
const fileName = getFileName(0);

const arrayBuffer = open(`../fixtures/files/${fileName}`, "b");
const file = http.file(arrayBuffer, fileName, "application/pdf");

export function setup() {
	return logIn(email, password);
}
export const process_attempts = new Counter("process_attempts");
export const upload_status = new Counter("upload_status");
export const process_status = new Counter("process_status");

export default function (setupResult: LogInResponse) {
	const original = file.filename;
	const dot = original.lastIndexOf(".");
	const base = dot === -1 ? original : original.slice(0, dot);
	const ext = dot === -1 ? "" : original.slice(dot).toLowerCase();
	const filePath = `${slugify(base, { lower: true })}-vu-${__VU}-iter_-${__ITER}${ext}`;

	/**
	 * TODO: the backend can't process the document upload as it is done by k6.
	 *  There are a lot of missing features you have to polyfill in the Sobek runtime.
	 *  Needs to be investigated / fixed.
	 */
	const uploadResponse = uploadDocument({
		file,
		filePath,
		...setupResult,
	});

	check(uploadResponse, {
		"upload response should return status is 204": (r) => r.status === 204,
	});

	upload_status.add(1, { status: String(uploadResponse.status) });

	sleep(1);

	let processResponse;
    for (let attempt = 1, wait = 0.5; attempt <= 5; attempt++, wait *= 2) {
    	processResponse = processDocument({ file, filePath, ...setupResult });
		process_attempts.add(1, { attempt: String(attempt), status: String(processResponse.status) });
		if (processResponse.status === 204) break;
    	sleep(wait); // seconds
    }

	check(processResponse, {
		"process response should return status is 204": (r) => r.status === 204,
	});

	process_status.add(1, { status: String(processResponse.status) });
}
