const DOMAIN_PATTERN =
	/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

export type DomainValidationError = "wildcard" | "invalidFormat";

export function validateDomainInput(
	value: string,
): DomainValidationError | null {
	const trimmed = value.trim();

	if (trimmed.includes("*")) {
		return "wildcard";
	}

	if (!DOMAIN_PATTERN.test(trimmed)) {
		return "invalidFormat";
	}

	return null;
}
