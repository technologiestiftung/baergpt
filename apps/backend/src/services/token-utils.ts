import { enc } from "../constants";

export type SafePayloadOptions = {
	providerTokenRatio?: number;
	outputReserveTokens?: number;
	marginTokens?: number;
	targetCap?: number;
	targetFloor?: number;
};

export function countTokens(text: unknown): number {
	const serialized = typeof text === "string" ? text : JSON.stringify(text);
	return enc.encode(serialized).length;
}

export function computeSafePayload(
	contextSize: number,
	systemTokens: number,
	{
		providerTokenRatio = 1.5,
		outputReserveTokens = 1024,
		marginTokens = 512,
		targetCap = 60000,
		targetFloor = 20000,
	}: SafePayloadOptions = {},
): number {
	const raw =
		Math.floor((contextSize - outputReserveTokens) / providerTokenRatio) -
		systemTokens -
		marginTokens;
	return Math.max(targetFloor, Math.min(targetCap, raw));
}

/**
 * Trim the input text to fit within the token limit
 * through a binary search approach
 */
export function trimToTokenLimitByWords(
	text: string,
	tokenLimit: number,
): string {
	if (countTokens(text) <= tokenLimit) {
		return text;
	}

	const words = text.split(/\s+/);

	let lowerBound = 0;
	let upperBound = words.length;

	while (lowerBound < upperBound) {
		const middle = Math.floor((lowerBound + upperBound + 1) / 2);

		const candidate = words.slice(0, middle).join(" ");

		if (countTokens(candidate) <= tokenLimit) {
			lowerBound = middle;
		} else {
			upperBound = middle - 1;
		}
	}

	return words.slice(0, lowerBound).join(" ");
}
