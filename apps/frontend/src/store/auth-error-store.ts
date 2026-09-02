import { create } from "zustand";
import content from "../content";
import { captureError } from "../monitoring/capture-error";
import type { Span } from "@sentry/react";

interface AuthErrorStore {
	error?: string;
	handleError: (error: unknown, span?: Span) => void;
}

const errorMessages: { [key: string]: string } = {
	"Invalid login credentials":
		content["form.validation.invalidCredentials.error"],
	privacy_not_accepted: content["form.validation.privacy.required.error"],
	"User is banned": content["form.validation.userBanned.error"],
};

export const useAuthErrorStore = create<AuthErrorStore>()((set) => ({
	error: undefined,

	handleError: (error, span) => {
		captureError(error, span);

		if (!isError(error)) {
			console.error("Given error object is not an instance of Error:", error);
			return;
		}

		const userReadableErrorMessage = errorMessages[error.message];

		if (!userReadableErrorMessage) {
			return;
		}

		// Set the error without clearing it automatically
		set({ error: userReadableErrorMessage });
	},
}));

function isError(error: unknown): error is Error {
	return error instanceof Error;
}
