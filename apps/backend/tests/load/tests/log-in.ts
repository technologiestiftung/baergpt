import { check } from "k6";
// @ts-expect-error k6 needs the .ts extension
import { logIn } from "../fixtures/log-in.ts";
// @ts-expect-error k6 needs the .ts extension
import { email, password } from "../fixtures/constants.ts";

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

export default async function () {
	const logInResponse = await logIn(email, password);

	check(logInResponse, {
		"log-in should return a session": (response) => "session" in response,
	});
}
