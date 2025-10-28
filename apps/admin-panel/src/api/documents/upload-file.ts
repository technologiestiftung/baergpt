import { useAuthStore } from "../../store/use-auth-store";
import { useAccessGroupStore } from "@/store/use-access-group-store";

/**
 * Uploads the file to storage via the /documents/upload endpoint using FormData.
 */
export async function uploadFileToDb(
	file: File,
	filePath: string,
): Promise<void> {
	const { session } = useAuthStore.getState();

	const form = new FormData();
	form.append("file", file, file.name);
	form.append("sourceUrl", filePath);
	form.append("isPublicDocument", "true");

	const response = await fetch(
		`${import.meta.env.VITE_API_URL}/documents/upload`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${session?.access_token}`,
			},
			body: form,
		},
	);

	if (response.status === 409) {
		throw new Error("failed.duplicate");
	}

	if (!response.ok) {
		const errorResponse = await response
			.json()
			.catch(() => ({ message: "Unknown error" }));
		console.error("Upload failed:", errorResponse);
		throw new Error("failed.generic");
	}
}

/**
 * Processes the uploaded document via the /documents/process endpoint.
 */
export async function processDocument(
	file: File,
	filePath: string,
): Promise<void> {
	const { session } = useAuthStore.getState();
	const access_group_id = useAccessGroupStore.getState().accessGroupId;

	// Create document metadata
	const documentData = {
		document: {
			id: null,
			file_name: file.name,
			folder_id: null,
			owned_by_user_id: null,
			created_at: new Date().toISOString(),
			source_type: "public_document",
			source_url: filePath,
			access_group_id: access_group_id,
			uploaded_by_user_id: session?.user.id,
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

		if (response.status === 409) {
			throw new Error("failed.duplicate");
		}

		console.error("Document processing failed:", errorResponse);
		throw new Error("failed.generic");
	}
}
