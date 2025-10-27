import http from "k6/http";
// @ts-expect-error k6 needs the .ts extension
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./constants.ts";

export type Session = {
	access_token: string;
	user: {
		id: number;
	};
};

export type LogInResponse = { session: Session } | { error: Error };

export async function logIn(
	email: string,
	password: string,
): Promise<LogInResponse> {
	const response = http.post(
		`${SUPABASE_URL}/auth/v1/token?grant_type=password`,
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
		return { error: new Error(`Login failed with status ${response.status}`) };
	}

	return { session: response.json() as Session };
}
