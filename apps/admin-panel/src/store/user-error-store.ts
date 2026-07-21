import { create } from "zustand";
import Content from "../content";

interface UserErrorStore {
	error?: string;
	clearErrors: () => void;
	handleError: (error: unknown) => void;
}

const errorMessages: { [key: string]: string } = {
	"Failed to add allowed email domain":
		Content["addNewDomain.form.unsuccessful.error"],
	"Failed to add individual email":
		Content["addNewIndividualEmail.form.unsuccessful.error"],
	'duplicate key value violates unique constraint "allowed_individual_emails_email_key"':
		Content["addNewIndividualEmail.form.emailAlreadyExistsError"],
	'new row for relation "allowed_individual_emails" violates check constraint "allowed_individual_emails_format"':
		Content["addNewIndividualEmail.form.wrongFormat"],
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
