import { captureException } from "@sentry/node";

export function captureError(error: Error | string | unknown): void {
	console.error(error);

	if (error instanceof Error) {
		captureException(error);
		return;
	}

	if (typeof error === "string") {
		captureException(new Error(`string thrown: ${error}`));
		return;
	}

	if (typeof error === "object") {
		const errorJson = stringify(error);
		captureException(new Error(`object thrown: ${errorJson}`));
		return;
	}

	captureException(new Error(`unknown type thrown: ${error}`));
}

function stringify(errorObject: object | null): string {
	try {
		return JSON.stringify(errorObject);
	} catch (error) {
		captureError(error);
		return `${errorObject}`;
	}
}
