import crypto from "crypto";
import { config } from "./config";

export function getHash(documentBuffer: Uint8Array): string {
	const hashSum = crypto.createHash("md5");
	hashSum.update(documentBuffer);
	const hex = hashSum.digest("hex");
	return hex;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function retryOperation<T>(
	operation: () => Promise<T>,
	retries: number = config.maxRetries || 3,
	retryDelay: number = config.retryDelay || 1000,
	maxRetries: number = retries,
): Promise<T> {
	try {
		return await operation();
	} catch (error) {
		if (retries <= 0) {
			throw error;
		}

		// Exponential backoff with jitter
		const backoffDelay =
			retryDelay * Math.pow(2, maxRetries - retries) + Math.random() * 1000;

		console.warn(
			`Operation failed: ${
				error instanceof Error
					? `${error.name}: ${error.message}`
					: String(error)
			}. Retrying in ${Math.round(backoffDelay)}ms... (${retries} retries left)`,
		);

		await wait(backoffDelay);
		return retryOperation(operation, retries - 1);
	}
}

/**
 * Runs a promise-returning operation and rejects if it does not settle within timeoutMs.
 * Note: This does not cancel the underlying operation if it doesn't support abort.
 */
export async function withTimeout<T>(
	op: () => Promise<T>,
	timeoutMs: number,
): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		let finished = false;
		const timer = setTimeout(() => {
			if (finished) return;
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
	} = {},
): Promise<T> {
	const {
		timeout = 10000,
		retries = config.maxRetries || 3,
		retryDelay = config.retryDelay || 1000,
	} = options;

	const wrappedOp = timeout ? () => withTimeout(operation, timeout) : operation;

	return retryOperation(wrappedOp, retries, retryDelay);
}
