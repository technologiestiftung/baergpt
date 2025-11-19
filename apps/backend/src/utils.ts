import crypto from "crypto";
import { captureError } from "./monitoring/capture-error";
import { scheduleDistributed } from "./services/distributed-limiter";
import { maxRetries, retryDelay } from "./constants";

export function getHash(documentBuffer: Uint8Array): string {
	const hashSum = crypto.createHash("md5");
	hashSum.update(documentBuffer);
	const hex = hashSum.digest("hex");
	return hex;
}

export const wait = (ms: number) =>
	new Promise((resolve) => setTimeout(resolve, ms));

async function withRetries<T>(operation: () => Promise<T>): Promise<T> {
	const attempt = async (remainingRetries: number): Promise<T> => {
		try {
			return await operation();
		} catch (error) {
			if (remainingRetries <= 0) {
				throw error;
			}

			// Exponential backoff with jitter
			const backoffDelay =
				retryDelay * Math.pow(2, maxRetries - remainingRetries) +
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

	return attempt(maxRetries);
}

export async function resilientCall<T>(
	operation: () => Promise<T>,
	options: {
		queueType?: "embeddings" | "llm";
	} = {},
): Promise<T> {
	const { queueType } = options;

	if (queueType === "embeddings") {
		return withRetries(() => scheduleDistributed("embeddings", operation));
	}

	if (queueType === "llm") {
		return withRetries(() => scheduleDistributed("llm", operation));
	}

	return withRetries(operation);
}

export function createBufferView(uint8Array: Uint8Array): Buffer {
	// this is a trick so the document is not stored twice in memory
	return Buffer.from(
		uint8Array.buffer,
		uint8Array.byteOffset,
		uint8Array.byteLength,
	);
}
