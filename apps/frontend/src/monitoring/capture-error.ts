import { captureException } from "@sentry/react";

/**
 * Errors that should *not* be forwarded to Sentry.
 */
export const NON_REPORTABLE_ERRORS = new Set<string | RegExp>([
	// Auth related
	"wrong_password",
	"User already registered",
	"Invalid login credentials",
	"privacy_not_accepted",
	"New password should be different from the old password.",
	"User account has been deactivated.",

	// Expected application errors
	"no_file_uploaded",
	"duplicate_file_upload",
	"file_size_limit_exceeded",
	"unsupported_filetype",
	"text_extraction_failed",
	"inappropriate_content",
	"token_rate_limit_exceeded",
	"unauthorized",
	"api_rate_limit_exceeded",
	"context_length_exceeded",
	"Failed to fetch",
	"selected_llm_not_healthy",
	"changed_to_default_llm",
	"changed_to_first_healthy_llm",
	"no_healthy_llm_available",
	"Token has expired or is invalid",
	/.*AbortError.*/,
]);

/**
 * Sends the error to Sentry if it is reportable and logs it to console.
 * Allows optional tags so the caller can specify the logical origin (e.g. "auth", "general").
 */
export function captureError(
	error: unknown,
	options?: { tags?: Record<string, string>; extra?: Record<string, unknown> },
): void {
	console.error(error);

	if (error instanceof Error) {
		captureException(error, options);
		return;
	}

	if (typeof error === "string") {
		captureException(new Error(`string thrown: ${error}`), options);
		return;
	}

	if (typeof error === "object") {
		const errorJson = stringify(error);
		captureException(new Error(`object thrown: ${errorJson}`), options);
		return;
	}

	captureException(error, options);
}

function stringify(errorObject: object | null): string {
	try {
		return JSON.stringify(errorObject);
	} catch (error) {
		captureError(error);
		return `${errorObject}`;
	}
}
