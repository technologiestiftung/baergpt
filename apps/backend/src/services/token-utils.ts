import { enc } from "../constants";
import { getTokenizerForModel } from "mistral-tokenizer-ts";

const mistralTokenizer = getTokenizerForModel("mistral-embed");

export function countMistralTokens(text: string): number {
	return mistralTokenizer.encode(text, true, true).length;
}

export function trimToMistralTokenLimitByWords(
	text: string,
	tokenLimit: number,
): string {
	// Reserve 1 extra token to absorb minor tokenization differences caused by
	// whitespace normalization when splitting/rejoining words.
	const safeLimit = tokenLimit - 1;
	if (countMistralTokens(text) <= safeLimit) {
		return text;
	}
	const words = text.split(/\s+/);
	let lo = 0;
	let hi = words.length;
	while (lo < hi) {
		const mid = Math.floor((lo + hi + 1) / 2);
		const candidate = words.slice(0, mid).join(" ");
		if (countMistralTokens(candidate) <= safeLimit) {
			lo = mid;
		} else {
			hi = mid - 1;
		}
	}
	return words.slice(0, lo).join(" ");
}

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
