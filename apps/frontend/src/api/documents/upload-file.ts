import { useAuthStore } from "../../store/auth-store";
import { useCurrentFolderStore } from "../../store/use-current-folder-store.ts";
import {
	UPLOAD_STATUS_MAP,
	type UploadStatusKeys,
} from "../../store/use-file-uploads-store.ts";
import { captureError } from "../../monitoring/capture-error.ts";
import { config } from "../../config.ts";
import { supabase } from "../../../supabase-client";
import { useUserFolderStore } from "../../store/use-user-folder-store.ts";
import { isUserFolder } from "../../components/documents/document-list/list-item/utils/is-user-folder.ts";

/**
 * The current folder may have been deleted elsewhere (e.g. in another tab).
 * In that case fall back to the main file collection and refresh the folders.
 */
async function resolveFolderId(): Promise<number | null> {
	const { currentFolder, setCurrentFolder } = useCurrentFolderStore.getState();
	if (!currentFolder || !isUserFolder(currentFolder)) {
		return currentFolder?.id ?? null;
	}

	const { data, error } = await supabase
		.from("document_folders")
		.select("id")
		.eq("id", currentFolder.id)
		.maybeSingle();

	if (error || data) {
		return currentFolder.id;
	}

	setCurrentFolder(null);
	await useUserFolderStore
		.getState()
		.getUserFolders(new AbortController().signal);
	return null;
}

export async function uploadAndProcessDocument(
	file: File,
	updateFileUploadStatusCallback: (
		status: UploadStatusKeys,
		existingFileName?: string,
	) => void,
): Promise<number> {
	const { session } = useAuthStore.getState();
	const folderId = await resolveFolderId();

	// Create document metadata
	const documentData = {
		document: {
			folderId,
			sourceType: "personal_document",
		},
		llmModel: config.defaultDocumentProcessingModel,
	};

	const form = new FormData();
	form.append("file", file);
	form.append("metadata", JSON.stringify(documentData));

	updateFileUploadStatusCallback("uploading");

	const url = `${import.meta.env.VITE_API_URL}/documents/process`;

	const response = await fetch(url, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${session?.access_token}`,
		},
		body: form,
	});

	if (!response.ok) {
		const errorResponse = await response
			.json()
			.catch(() => ({ message: "Unknown error" }));

		throw new Error(
			`Document processing failed: ${JSON.stringify(errorResponse)}`,
		);
	}

	if (!response.body) {
		throw new Error("Document processing response has no body");
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	let documentId: number | null = null;

	try {
		while (true) {
			const { done, value } = await reader.read();

			if (done) {
				break;
			}

			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split("\n");
			buffer = lines.pop() ?? "";

			for (const line of lines) {
				const prefix = "data: ";
				if (!line.startsWith(prefix)) {
					continue;
				}

				const payload = line.slice(prefix.length).trim();
				if (!payload) {
					continue;
				}

				let event;
				try {
					event = JSON.parse(payload);
				} catch {
					continue; // ignore anything unparseable, it can be just a heartbeat
				}

				const status: unknown = event?.status;

				if (typeof status !== "string" || !(status in UPLOAD_STATUS_MAP)) {
					continue;
				}

				updateFileUploadStatusCallback(
					status as UploadStatusKeys,
					event.existingFileName,
				);

				if (status.startsWith("failed")) {
					throw new Error(status);
				}

				if (event.status === "successful") {
					documentId = event.documentId;
				}
			}
		}
	} finally {
		reader.cancel().catch((error) => captureError(error));
	}

	if (documentId === null) {
		throw new Error("Stream finished without receiving a documentId");
	}

	return documentId;
}
