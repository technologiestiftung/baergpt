/**
 * Explanation of the regex:
 *
 *
 * [A-Za-z0-9._%+-]+: A stricter match for the local part.
 *
 * Domains:
 * ts\.berlin matches exactly that domain.
 * ([A-Za-z0-9-]+\.)?berlin\.de matches berlin.de and allows optional subdomains.
 * itdz-berlin\.de matches exactly that domain.
 *
 * $: Anchors the pattern
 * g modifier: global. All matches (don't return after first match)
 * i modifier: case-insensitive. Matches both upper and lower case letters
 * m modifier: multi line. Causes ^ and $ to match the begin/end of each line (not only begin/end of string)
 */

export const emailValidationRegex =
	/^[A-Za-z0-9._%+-]+@(ts\.berlin|([A-Za-z0-9-]+\.)?berlin\.de|itdz-berlin.de)$/im;
