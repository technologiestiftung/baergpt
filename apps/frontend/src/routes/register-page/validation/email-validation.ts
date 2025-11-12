import Content from "../../../content.ts";

/**
 * Configuration for email domain validation
 */
export type DomainConfig = {
	domain: string;
	allowSubdomains?: boolean;
};

/**
 * Cache for compiled regex patterns to improve performance
 */
const regexCache = new Map<string, RegExp>();

/**
 * More comprehensive email local part validation
 * Based on RFC 5322 specification but simplified for practical use
 *
 * [A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+: Letters, digits, and RFC 5322 special characters
 * (?:\\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*: Optional dot-separated segments
 *
 * Prevents consecutive dots and dots at start/end of local part
 * Valid: john, john.doe, user+tag | Invalid: .john, john., john..doe
 */
const EMAIL_LOCAL_PART_PATTERN =
	"[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*";

/**
 * Escapes special regex characters in a string
 *
 * [.*+?^${}()|[\]\\]: Matches all regex special characters
 * \\$&: Adds backslash before each matched character
 *
 * Example: "hello.world" becomes "hello\\.world"
 */
function escapeRegexString(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Creates domain pattern with optional subdomain support
 * For domains like *.berlin.de, requires subdomains (excludes bare domain)
 * For domains like berlin.de, allows exact match only
 */
function createDomainPattern(config: DomainConfig): string {
	const escapedDomain = escapeRegexString(config.domain);

	if (config.allowSubdomains) {
		// Require subdomains: *.domain.tld but NOT domain.tld
		// This matches the pattern [A-Za-z0-9-]+\.domain.com (subdomain required)
		return `[A-Za-z0-9-]+\\.${escapedDomain}`;
	}

	return escapedDomain;
}

/**
 * Parses domain strings that might include wildcard notation
 * Examples: "*.berlin.de", "berlin.de", "ts.berlin"
 */
function parseDomainString(domainString: string): DomainConfig {
	const trimmed = domainString.trim();

	// Check for wildcard patterns
	if (trimmed.startsWith("*.")) {
		const domain = trimmed.slice(2); // Remove the "*."
		return {
			domain,
			allowSubdomains: true,
		};
	}

	// No wildcard, use the domain as-is without subdomains
	return {
		domain: trimmed,
		allowSubdomains: false,
	};
}

/**
 * Converts simple domain strings to DomainConfig objects
 * Supports wildcard notation from database entries like "*.berlin.de"
 */
function normalizeDomainConfigs(domains: string[]): DomainConfig[] {
	return domains.map(parseDomainString);
}

/**
 * Creates a cache key for the regex based on domain configurations
 */
function createCacheKey(domainConfigs: DomainConfig[]): string {
	return domainConfigs
		.map((config) => `${config.domain}:${config.allowSubdomains}`)
		.sort()
		.join("|");
}

/**
 * Creates a dynamic email validation regex based on allowed email domains
 *
 * @param allowedDomains - Array of allowed email domains (strings) - supports wildcards like "*.berlin.de"
 * @param domainConfigs - Optional array of domain configurations for advanced control
 * @returns RegExp object for email validation, or null if no domains provided
 *
 * Example usage:
 * ```typescript
 * // Simple usage with wildcard support
 * const domains = ["*.berlin.de", "ts.berlin", "itdz-berlin.de"];
 * const regex = createEmailValidationRegex(domains);
 *
 * // Advanced usage with explicit configuration
 * const configs = [
 *   { domain: "berlin.de", allowSubdomains: true },
 *   { domain: "ts.berlin", allowSubdomains: false }
 * ];
 * const regex = createEmailValidationRegex([], configs);
 * ```
 */
export function createEmailValidationRegex(
	allowedDomains: string[] = [],
	domainConfigs?: DomainConfig[],
): RegExp | null {
	// Use explicit configs or create from domain strings
	const configs =
		domainConfigs ||
		(allowedDomains.length > 0 ? normalizeDomainConfigs(allowedDomains) : []);

	// If no domains are provided, return null to indicate no validation possible
	if (configs.length === 0) {
		return null;
	}

	// Check cache first for performance
	const cacheKey = createCacheKey(configs);
	const cachedRegex = regexCache.get(cacheKey);
	if (cachedRegex) {
		return cachedRegex;
	}

	// Create domain patterns
	const domainPatterns = configs.map(createDomainPattern);
	const domainsPattern = domainPatterns.join("|");

	// Combine local part and domain patterns
	const pattern = `^${EMAIL_LOCAL_PART_PATTERN}@(${domainsPattern})$`;
	const regex = new RegExp(pattern, "i"); // Case-insensitive only

	// Cache the result
	regexCache.set(cacheKey, regex);

	return regex;
}

/**
 * Validates email against allowed domains with better error context
 */
export function validateEmail(
	email: string,
	allowedDomains?: string[],
): {
	isValid: boolean;
	error?: string;
	allowedDomains: string[];
} {
	// If no domains are provided, we cannot validate
	if (!allowedDomains || allowedDomains.length === 0) {
		return {
			isValid: false,
			error: "No allowed email domains configured",
			allowedDomains: [],
		};
	}

	const regex = getEmailValidationRegex(allowedDomains);
	if (!regex) {
		return {
			isValid: false,
			error: "Email validation not available",
			allowedDomains,
		};
	}

	const isValid = regex.test(email);

	return {
		isValid,
		error: isValid ? undefined : Content["form.validation.email.customError"],
		allowedDomains,
	};
}

/**
 * Gets the allowed email domains from the auth store and creates a validation regex
 * This is the main function to use in components
 *
 * @param allowedDomains - Array of allowed email domains from auth store
 * @returns RegExp object for email validation, or null if no domains available
 */
export function getEmailValidationRegex(
	allowedDomains?: string[],
): RegExp | null {
	return createEmailValidationRegex(allowedDomains || []);
}

/**
 * Clears the regex cache - useful for testing or if domain configs change frequently
 */
export function clearRegexCache(): void {
	regexCache.clear();
}
