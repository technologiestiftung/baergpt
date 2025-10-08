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
  }: SafePayloadOptions = {}
): number {
  const raw =
    Math.floor((contextSize - outputReserveTokens) / providerTokenRatio) -
    systemTokens -
    marginTokens;
  return Math.max(targetFloor, Math.min(targetCap, raw));
}

export function trimToTokenLimitByWords(text: string, tokenLimit: number): string {
  if (countTokens(text) <= tokenLimit) return text;
  const words = text.split(/\s+/);
  let lo = 0;
  let hi = words.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    const candidate = words.slice(0, mid).join(" ");
    if (countTokens(candidate) <= tokenLimit) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return words.slice(0, lo).join(" ");
}

export function computeBatchTokenLimit(totalLimit: number, safetyMargin = 1000): number {
  return Math.max(0, totalLimit - safetyMargin);
}


