import { check } from "k6";
// @ts-expect-error k6 needs the .ts extension
import { getInference } from "../fixtures/inference.ts";
// @ts-expect-error k6 needs the .ts extension
import { logIn, LogInResponse } from "../fixtures/log-in.ts";
// @ts-expect-error k6 needs the .ts extension
import { email, getPrompt, password } from "../fixtures/constants.ts";

export const options = {
	// todo: enable / disable the tests types by commenting / uncommenting

	/**
	 * Smoke Test
	 */
	vus: 100,
	duration: "1m",

	/**
	 * Spike Test
	 */
	// stages: [
	// 	{ duration: "2m", target: 2000 }, // fast ramp-up to a high point
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

export async function setup() {
	return logIn(email, password);
}

export default function (setupResult: LogInResponse) {
	// todo: so far we are always using the same prompt.
	//  to make the test more realistic, we should probably
	//  vary the prompt based on the __ITER variable
	//  (e.g. getPrompt(__ITER) )
	//  there are more prompts defined in the constants file but they need
	//  document uploading first.

	const prompt = getPrompt(0);

	const inferenceResponse = getInference({ ...prompt, ...setupResult });

	check(inferenceResponse, {
		"inference should return status is 200": (r) => r.status === 200,
	});
}
