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

export const options = {
	// todo: enable / disable the tests types by commenting / uncommenting

	/**
	 * Smoke Test
	 */
	vus: 1,
	duration: "10s",

	/**
	 * Spike Test
	 */
	// stages: [
	// 	{ duration: "2m", target: 10 }, // fast ramp-up to a high point
	// 	// No plateau
	// 	{ duration: "1m", target: 0 }, // quick ramp-down to 0 users
	// ],

	/**
	 * Stress Test
	 *  todo: the target here is definitely too high
	 */
	// stages: [
	// 	{ duration: "10m", target: 200 }, // traffic ramp-up from 1 to a higher 200 users over 10 minutes.
	// 	{ duration: "30m", target: 200 }, // stay at higher 200 users for 30 minutes
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

export default function (setupResult: LogInResponse) {
	const filePath = slugify(`${file.filename}-${__ITER}`, {
		lower: true,
	});

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

	sleep(1);

	const processResponse = processDocument({
		file,
		filePath,
		...setupResult,
	});

	check(processResponse, {
		"process response should return status is 204": (r) => r.status === 204,
	});
}
