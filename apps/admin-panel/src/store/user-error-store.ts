import { create } from "zustand";
import Content from "../content";

interface UserErrorStore {
	error?: string;
	clearErrors: () => void;
	handleError: (error: unknown) => void;
}

const errorMessages: { [key: string]: string } = {
	"Failed to send invite link":
		Content["form.validation.invite.unsuccessful.error"],
};

export const useUserErrorStore = create<UserErrorStore>()((set) => ({
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
