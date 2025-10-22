import { useAuthStore } from "../../store/auth-store";
import { useFolderStore } from "../../store/folder-store";

/**
 * Uploads the file to storage via the /documents/upload endpoint.
 */
export async function uploadFileToDb(
	file: File,
	filePath: string,
): Promise<void> {
	const { session } = useAuthStore.getState();
	const form = new FormData();
	form.append("file", file, file.name);
	form.append("sourceUrl", filePath);

	const response = await fetch(
		`${import.meta.env.VITE_API_URL}/documents/upload`,
		{
			method: "POST",
			headers: { Authorization: `Bearer ${session?.access_token}` },
			body: form,
		},
	);
	if (response.status === 409) {
		throw new Error("failed.duplicate");
	}
	if (!response.ok) {
		throw new Error("failed.generic");
	}
}

/**
 * Process: metadata only; backend loads file bytes by sourceUrl
 */
export async function processDocument(
	file: File,
	filePath: string,
): Promise<void> {
	const { session } = useAuthStore.getState();
	const { currentFolder } = useFolderStore.getState();

	// Create document metadata
	const documentData = {
		document: {
			id: null,
			file_name: file.name,
			folder_id: currentFolder?.id || null,
			owned_by_user_id: session?.user.id,
			created_at: new Date().toISOString(),
			source_type: "personal_document",
			source_url: filePath,
			metadata: {
				mimeType: file.type,
				size: file.size,
			},
		},
	};

	const url = `${import.meta.env.VITE_API_URL}/documents/process`;

	const response = await fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${session?.access_token}`,
		},
		body: JSON.stringify(documentData),
	});

	if (!response.ok) {
		const errorResponse = await response
			.json()
			.catch(() => ({ message: "Unknown error" }));

		// Handle specific backend error codes
		if (response.status === 409) {
			throw new Error("failed.duplicate");
		}

		console.error("Document processing failed:", errorResponse);
		throw new Error("failed.generic");
	}
}
