import { create } from "zustand";
import content from "../content";
import { captureError } from "../monitoring/capture-error";

interface AuthErrorStore {
	error?: string;
	handleError: (error: unknown) => void;
}

const errorMessages: { [key: string]: string } = {
	wrong_password: content["form.validation.password.wrong.error"],
	"User already registered":
		content["form.validation.userAlreadyRegistered.error"],
	"Invalid login credentials":
		content["form.validation.invalidCredentials.error"],
	privacy_not_accepted: content["form.validation.privacy.required.error"],
	"New password should be different from the old password.":
		content["form.validation.password.shouldBeDifferent.error"],
	"User account has been deactivated.":
		content["form.validation.userDeactivated.error"],
};

export const useAuthErrorStore = create<AuthErrorStore>()((set) => ({
	error: undefined,

	handleError: (error) => {
		if (!isError(error)) {
			console.error("Given error object is not an instance of Error:", error);
			return;
		}

		captureError(error);

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
