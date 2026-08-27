import { config } from "./config";
import { maxRetries, retryDelay } from "./constants";

const RETRYABLE_STATUS = new Set([502, 503, 504]);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function describeRequest(
	input: Parameters<typeof fetch>[0],
	init?: Parameters<typeof fetch>[1],
): { method: string; path: string } {
	if (input instanceof Request) {
		return { method: init?.method ?? input.method, path: input.url };
	}
	const url = input instanceof URL ? input.href : input;
	return { method: init?.method ?? "GET", path: url };
}

// Read the body off a clone so the original response stays consumable by the
// caller (the final attempt returns the response even if it's a 5xx).
async function readBodySafely(response: Response): Promise<string> {
	try {
		return await response.clone().text();
	} catch {
		return "<unreadable body>";
	}
}

/**
 * Kong (the Supabase gateway) intermittently returns transient upstream
 * errors — most notably 502 "An invalid response was received from the
 * upstream server", but also 503/504. These indicate the gateway failed to
 * get a valid response from the upstream. Adding experimental retrying
 * to see if that reduces flakiness during testing.
 */
export const retryingFetch: typeof fetch = async (input, init) => {
	/**
	 * Let's use it only during tests for now
	 */
	if (config.nodeEnv !== "test") {
		return fetch(input, init);
	}

	let lastError: unknown;

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			const response = await fetch(input, init);

			if (RETRYABLE_STATUS.has(response.status)) {
				const { method, path } = describeRequest(input, init);
				const body = await readBodySafely(response);
				if (attempt < maxRetries) {
					console.warn(
						`[retrying-fetch] ${method} ${path} returned ${response.status}, retrying (attempt ${attempt + 1}/${maxRetries}). Body: ${body}`,
					);
					await wait(retryDelay * 2 ** attempt);
					continue;
				}
				console.error(
					`[retrying-fetch] ${method} ${path} returned ${response.status} after ${maxRetries} retries. Body: ${body}`,
				);
			}

			return response;
		} catch (error) {
			// Network-level failure (connection reset, DNS, etc.) — also transient.
			lastError = error;
			const { method, path } = describeRequest(input, init);
			if (attempt < maxRetries) {
				console.warn(
					`[retrying-fetch] ${method} ${path} threw, retrying (attempt ${attempt + 1}/${maxRetries}):`,
					error,
				);
				await wait(retryDelay * 2 ** attempt);
				continue;
			}
			console.error(
				`[retrying-fetch] ${method} ${path} failed after ${maxRetries} retries:`,
				error,
			);
			throw error;
		}
	}

	// Unreachable: the loop either returns a response or throws.
	throw lastError;
};
