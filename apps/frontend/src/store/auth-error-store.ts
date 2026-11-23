import { create } from "zustand";
import content from "../content";
import { captureError } from "../monitoring/capture-error";
import type { Span } from "@sentry/react";

interface AuthErrorStore {
	error?: string;
	handleError: (error: unknown, span?: Span) => void;
	clearError: () => void;
}

const errorMessages: { [key: string]: string } = {
	privacy_not_accepted: content["form.validation.privacy.required.error"],
	"User is banned": content["form.validation.userBanned.error"],
	email_not_allowed: content["form.validation.email.customError"],
	login_rate_limited: content["loginPage.error.rateLimited"],
	login_failed: content["loginPage.error.generic"],
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

	clearError: () => set({ error: undefined }),
}));

function isError(error: unknown): error is Error {
	return error instanceof Error;
}
