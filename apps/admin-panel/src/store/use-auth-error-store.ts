import { create } from "zustand";
import Content from "../content";

interface AuthErrorStore {
	error?: string;
	clearErrors: () => void;
	handleError: (error: unknown) => void;
}

const errorMessages: { [key: string]: string } = {
	wrong_password: Content["form.validation.password.worng.error"],
	"Invalid login credentials":
		Content["form.validation.invalidCredentials.error"],
	privacy_not_accepted: Content["form.validation.privacy.required.error"],
	"User account has been deactivated.":
		Content["form.validation.userDeactivated.error"],
};

export const useAuthErrorStore = create<AuthErrorStore>()((set) => ({
	error: undefined,

	clearErrors: () => set({ error: undefined }),

	handleError: (error) => {
		if (!isError(error)) {
			console.error("Given error object is not an instance of Error:", error);
			return;
		}

		console.error(error);

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
