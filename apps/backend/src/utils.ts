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
): Promise<T> {
	const maxRetries = config.maxRetries || 3;
	const retryDelay = config.retryDelay || 1000;

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
			`Operation failed, retrying in ${backoffDelay}ms... (${retries} retries left)`,
		);

		await wait(backoffDelay);
		return retryOperation(operation, retries - 1);
	}
}

export function validateAndCleanBase64(base64Document: string): string {
	// Remove data URL prefix if present (e.g., "data:application/vnd...;base64,")
	let cleanBase64 = base64Document;
	if (cleanBase64.includes(",")) {
		cleanBase64 = cleanBase64.split(",")[1];
	}

	// Remove any whitespace or newlines
	cleanBase64 = cleanBase64.replace(/\s/g, "");

	// Validate base64 format
	if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleanBase64)) {
		throw new Error("Invalid base64 format");
	}

	return cleanBase64;
}
