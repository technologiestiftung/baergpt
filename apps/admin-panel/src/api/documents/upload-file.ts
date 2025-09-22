import { useAuthStore } from "../../store/use-auth-store";
import { useAccessGroupStore } from "@/store/use-access-group-store";

/**
 * Converts a File to a base64-encoded string.
 */
async function convertFileToBase64(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const arrayBuffer = reader.result as ArrayBuffer;
			const uint8Array = new Uint8Array(arrayBuffer);
			const binaryString = Array.from(uint8Array)
				.map((byte) => String.fromCharCode(byte))
				.join("");
			const base64 = btoa(binaryString);
			resolve(base64);
		};
		reader.onerror = reject;
		reader.readAsArrayBuffer(file);
	});
}

/**
 * Uploads the file to storage via the /documents/upload endpoint.
 * Returns the base64 string so it can be reused in processDocument.
 */
export async function uploadFileToDb(
	file: File,
	filePath: string,
): Promise<string> {
	const { session } = useAuthStore.getState();

	const fileBase64 = await convertFileToBase64(file);

	const response = await fetch(
		`${import.meta.env.VITE_API_URL}/documents/upload`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${session?.access_token}`,
			},
			body: JSON.stringify({
				base64Document: fileBase64,
				sourceUrl: filePath,
				isPublicDocument: true,
			}),
		},
	);

	// Handle 409 Conflict (duplicate file) as a specific error
	if (response.status === 409) {
		throw new Error("failed.duplicate");
	}

	// Handle other HTTP errors
	if (!response.ok) {
		const errorResponse = await response
			.json()
			.catch(() => ({ message: "Unknown error" }));
		console.error("Upload failed:", errorResponse);
		throw new Error("failed.generic");
	}

	return fileBase64;
}

/**
 * Processes the uploaded document via the /documents/process endpoint.
 */
export async function processDocument(
	file: File,
	filePath: string,
	fileBase64: string,
): Promise<void> {
	const { session } = useAuthStore.getState();
	const access_group_id = useAccessGroupStore.getState().accessGroupId;

	// Create document metadata
	const documentData = {
		base64Document: fileBase64,
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

		// Handle specific backend error codes
		if (response.status === 409) {
			throw new Error("failed.duplicate");
		}

		console.error("Document processing failed:", errorResponse);
		throw new Error("failed.generic");
	}
}
