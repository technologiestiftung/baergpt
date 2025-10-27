import http from "k6/http";
// @ts-expect-error k6 needs the .ts extension
import { Session } from "./log-in.ts";
// @ts-expect-error k6 needs the .ts extension
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./constants.ts";

export async function register(
	email: string,
	password: string,
): Promise<{ session: Session } | { error: Error }> {
	const response = http.post(
		`${SUPABASE_URL}/auth/v1/signup`,
		JSON.stringify({
			email,
			password,
		}),
		{
			headers: {
				"Content-Type": "application/json",
				apikey: SUPABASE_ANON_KEY,
			},
		},
	);

	if (response.status !== 200) {
		return {
			error: new Error(`Register failed with status ${response.status}`),
		};
	}

	return { session: response.json() as Session };
}
