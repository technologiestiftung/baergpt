import { create } from "zustand";
import { useToastStore } from "./use-toast-store";
import { captureError } from "../monitoring/capture-error";

interface ErrorStore {
	error?: string;
	handleError: (error: unknown) => void;
	getErrorMessage: (error: unknown) => string | null;
}

const errorMessages: { [key: string]: string } = {
	failed_to_call_llm: "Fehler beim Aufrufen des LLM.",
	no_file_uploaded: "Es wurde keine Datei hochgeladen.",
	duplicate_file_upload: "Diese Datei wurde bereits hochgeladen.",
	file_size_limit_exceeded: "Ihre Datei ist zu groß, das Limit beträgt 8 MB",
	unsupported_filetype:
		"Datei-Upload unterstützt nur die folgenden Dateitypen: .pdf, .docx, .doc und .xlsx",
	text_extraction_failed:
		"Unerwarteter Fehler beim Extrahieren des Dokumentinhalts.",
	inappropriate_content: "Die Nachricht enthält unangemessene Inhalte.",
	token_rate_limit_exceeded:
		"Token-Rate-Limit überschritten, bitte in einer Minute nochmal versuchen.",
	unauthorized: "Unberechtigt.",
	api_rate_limit_exceeded:
		"API-Rate-Limit überschritten, bitte in einer Minute nochmal versuchen.",
	context_length_exceeded:
		"Kontextlänge überschritten, bitte starten Sie einen neuen Chat.",
	wrong_password: "Falsches Passwort.",
	"Failed to fetch":
		"Etwas ist schief gelaufen, bitte starten Sie einen neuen Chat.",
	selected_llm_not_healthy:
		"Das ausgewählte Modell ist temporär nicht verfügbar, bitte wählen Sie ein alternatives Modell in den Einstellungen.",
	changed_to_default_llm:
		"Das ausgewählte Modell ist temporär nicht verfügbar, es wurde auf das Standardmodell zurückgesetzt.",
	changed_to_first_healthy_llm:
		"Das Standardmodell ist temporär nicht verfügbar, es wurde auf das erste verfügbare Modell zurückgesetzt.",
	no_healthy_llm_available:
		"Temporär keine Modelle verfügbar. Bitte versuchen Sie es später erneut.",
	"Token has expired or is invalid": "Code ist abgelaufen oder ungültig.",
	document_not_found: "Dokument konnte nicht gelöscht werden.",
};

export const useErrorStore = create<ErrorStore>()(() => ({
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

		// Only use toast store
		useToastStore.getState().addError(userReadableErrorMessage);
	},

	getErrorMessage: (error) => {
		if (!isError(error)) {
			console.error("Given error object is not an instance of Error:", error);
			return null;
		}

		return errorMessages[error.message] || null;
	},
}));

function isError(error: unknown): error is Error {
	return error instanceof Error;
}
