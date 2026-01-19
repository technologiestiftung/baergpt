import { StorageApiError } from "@supabase/storage-js";
import { useAuthStore } from "../../store/auth-store";
import { useFolderStore } from "../../store/folder-store";
import { supabase } from "../../../supabase-client";

/**
 * Uploads the file directly to Supabase Storage.
 */
export async function uploadFileToDb(
	file: File,
	filePath: string,
): Promise<void> {
	//const { session } = useAuthStore.getState();
	try {
		const { error: uploadError } = await supabase.storage
			.from("documents")
			.upload(filePath, file);

		if (uploadError) {
			throw uploadError;
		}
	} catch (error) {
		if (error instanceof StorageApiError && error.status === 409) {
			throw new Error("failed.duplicate");
		} else {
			throw new Error("failed.generic");
		}
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
		llm_model: import.meta.env.VITE_DEFAULT_DOCUMENT_PROCESSING_MODEL,
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
