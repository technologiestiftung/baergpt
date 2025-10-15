import crypto from "crypto";
import { config } from "./config";
import { seconds, throttledQueue } from "throttled-queue";
import { captureError } from "./monitoring/capture-error";

const addToEmbeddingsQueue = throttledQueue({
	interval: seconds(1),
	maxPerInterval: config.jinaMaxRPS,
});

const addToLLMQueue = throttledQueue({
	interval: seconds(1),
	maxPerInterval: config.mistralMaxRPS,
});

export function getHash(documentBuffer: Uint8Array): string {
	const hashSum = crypto.createHash("md5");
	hashSum.update(documentBuffer);
	const hex = hashSum.digest("hex");
	return hex;
}

export const wait = (ms: number) =>
	new Promise((resolve) => setTimeout(resolve, ms));

async function withRetries<T>(
	operation: () => Promise<T>,
	{ retries, retryDelay }: { retries: number; retryDelay: number },
): Promise<T> {
	const attempt = async (remainingRetries: number): Promise<T> => {
		try {
			return await operation();
		} catch (error) {
			if (remainingRetries <= 0) {
				throw error;
			}

			// Exponential backoff with jitter
			const backoffDelay =
				retryDelay * Math.pow(2, retries - remainingRetries) +
				Math.random() * 1000;

			captureError(error);

			console.warn(
				`Operation failed: ${
					error instanceof Error
						? `${error.name}: ${error.message}`
						: String(error)
				}. Retrying in ${Math.round(backoffDelay)}ms... (${remainingRetries} retries left)`,
			);

			await wait(backoffDelay);
			return attempt(remainingRetries - 1);
		}
	};

	return attempt(retries);
}

/**
 * Runs a promise-returning operation and rejects if it does not settle within timeoutMs.
 * Note: This does not cancel the underlying operation if it doesn't support abort.
 */
async function withTimeout<T>(
	op: () => Promise<T>,
	timeoutMs: number,
): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		let finished = false;

		const timer = setTimeout(() => {
			if (finished) {
				return;
			}

			reject(new Error(`Operation timed out after ${timeoutMs}ms`));
		}, timeoutMs);

		op()
			.then((result) => {
				finished = true;
				clearTimeout(timer);
				resolve(result);
			})
			.catch((err) => {
				finished = true;
				clearTimeout(timer);
				reject(err);
			});
	});
}

export async function resilientCall<T>(
	operation: () => Promise<T>,
	options: {
		timeout?: number;
		retries?: number;
		retryDelay?: number;
		queueType?: "embeddings" | "llm";
	} = {},
): Promise<T> {
	const {
		timeout,
		retries = config.maxRetries,
		retryDelay = config.retryDelay,
		queueType,
	} = options;

	const wrappedOp = timeout ? () => withTimeout(operation, timeout) : operation;

	if (queueType === "embeddings") {
		return new Promise<T>((resolve, reject) => {
			addToEmbeddingsQueue(async () => {
				try {
					const result = await withRetries(wrappedOp, {
						retries,
						retryDelay,
					});
					resolve(result);
				} catch (error) {
					reject(error);
				}
			});
		});
	}

	if (queueType === "llm") {
		return new Promise<T>((resolve, reject) => {
			addToLLMQueue(async () => {
				try {
					const result = await withRetries(wrappedOp, {
						retries,
						retryDelay,
					});
					resolve(result);
				} catch (error) {
					reject(error);
				}
			});
		});
	}

	return withRetries(wrappedOp, { retries, retryDelay });
}
