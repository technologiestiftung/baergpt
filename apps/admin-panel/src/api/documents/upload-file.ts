import { useAuthStore } from "@/store/use-auth-store";
import { useAccessGroupStore } from "@/store/use-access-group-store";
import type { UploadStatusKeys } from "@/store/use-upload-document-store.ts";
import { UPLOAD_STATUS_MAP } from "baergpt-frontend/src/store/use-file-uploads-store.ts";

export async function uploadAndProcessDocument(
	file: File,
	updateFileUploadStatusCallback: (status: UploadStatusKeys) => void,
): Promise<void> {
	const { session } = useAuthStore.getState();
	const { accessGroupId } = useAccessGroupStore.getState();

	// Create document metadata
	const documentData = {
		document: {
			folderId: null,
			sourceType: "public_document",
			accessGroupId,
		},
		llmModel: import.meta.env.VITE_DEFAULT_DOCUMENT_PROCESSING_MODEL,
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

	try {
		while (true) {
			const { done, value } = await reader.read();

			if (done) {
				break;
			}

			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split("\n");
			buffer = lines.pop() ?? ""; // last line may be incomplete — keep i

			for (const line of lines) {
				if (!line.startsWith("data: ")) {
					continue;
				}

				const payload = line.slice(6).trim();
				if (!payload) {
					continue;
				}

				let event;
				try {
					event = JSON.parse(payload);
				} catch {
					continue; // ignore anything unparseable
				}

				const status: unknown = event?.status;

				if (typeof status !== "string" || !(status in UPLOAD_STATUS_MAP)) {
					continue;
				}

				updateFileUploadStatusCallback(status as UploadStatusKeys);

				if (status.startsWith("failed")) {
					throw new Error(status);
				}

				updateFileUploadStatusCallback(event.status);
			}
		}
	} finally {
		reader.cancel().catch((error) => console.error(error));
	}
}
