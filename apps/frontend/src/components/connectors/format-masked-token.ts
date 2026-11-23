const MASK_LENGTH = 16;

export function formatMaskedToken(last4?: string): string {
	return `${"•".repeat(MASK_LENGTH)}${last4 ?? ""}`;
}
