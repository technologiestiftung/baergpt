import { captureException } from "@sentry/node";

/** Searchable tags and extra data for the event. */
export type ErrorContext = {
	tags?: Record<string, string>;
	extra?: Record<string, unknown>;
};

export function captureError(
	error: Error | string | unknown,
	context?: ErrorContext,
): void {
	console.error(error);

	if (error instanceof Error) {
		captureException(error, context);
		return;
	}

	if (typeof error === "string") {
		captureException(new Error(`string thrown: ${error}`), context);
		return;
	}

	if (typeof error === "object") {
		const errorJson = stringify(error);
		captureException(new Error(`object thrown: ${errorJson}`), context);
		return;
	}

	captureException(new Error(`unknown type thrown: ${error}`), context);
}

function stringify(errorObject: object | null): string {
	try {
		return JSON.stringify(errorObject);
	} catch (error) {
		captureError(error);
		return `${errorObject}`;
	}
}
