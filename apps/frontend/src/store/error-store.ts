import { create } from "zustand";
import { useToastStore } from "./use-toast-store";
import { captureError } from "../monitoring/capture-error";
import Content from "../content";
import type { Span } from "@sentry/react";

interface ErrorStore {
	error?: string;
	uiErrors: Record<string, string>;
	handleError: (error: unknown, span?: Span) => void;
	getMessageForKey: (errorKey: string) => string | null;
	setUIError: (
		context: string,
		errorKey: string,
		options?: { autoClean?: boolean; timeout?: number },
	) => void;
	clearUIError: (context: string) => void;
	getUIError: (context: string) => string | null;
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
	wrong_password: Content["form.validation.password.wrong.error"],
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
	account_deletion_failed:
		"Ihr Konto konnte nicht gelöscht werden. Bitte versuchen Sie es erneut.",
	document_not_found: "Dokument konnte nicht gelöscht werden.",
	document_download_failed:
		Content["documentsPreviewSection.download.failed.error"],
	chat_export_failed: Content["chat.exportChatTextButton.error"],
	documents_fetch_failed: Content["documentsSection.fetch.error"],
	chats_fetch_failed: Content["chatHistory.fetch.error"],
};

export const useErrorStore = create<ErrorStore>()((set, get) => ({
	uiErrors: {},
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

		// Only use toast store for global errors
		useToastStore.getState().addError(userReadableErrorMessage);
	},

	getMessageForKey: (errorKey: string) => {
		return errorMessages[errorKey] || null;
	},

	setUIError: (
		context: string,
		errorKey: string,
		options?: { autoClean?: boolean; timeout?: number },
	) => {
		set((state) => ({
			uiErrors: {
				...state.uiErrors,
				[context]: errorKey,
			},
		}));

		// Auto-clear UI error after specified timeout (default: 3 seconds)
		const shouldAutoClean = options?.autoClean !== false; // Default to true
		const timeoutMs = options?.timeout ?? 3000; // Default to 3 seconds

		if (shouldAutoClean) {
			setTimeout(() => {
				get().clearUIError(context);
			}, timeoutMs);
		}
	},
	clearError: () => {
		set({ error: undefined });
	},

	clearUIError: (context: string) => {
		set((state) => {
			const newErrors = { ...state.uiErrors };
			// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
			delete newErrors[context];
			return { uiErrors: newErrors };
		});
	},

	getUIError: (context: string) => {
		const { uiErrors } = get();
		const errorKey = uiErrors[context];
		if (!errorKey) {
			return null;
		}
		return errorMessages[errorKey] || null;
	},
}));

function isError(error: unknown): error is Error {
	return error instanceof Error;
}
