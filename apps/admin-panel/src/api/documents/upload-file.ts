import { useAuthStore } from "../../store/use-auth-store";
import { useAccessGroupStore } from "@/store/use-access-group-store";
import { supabase } from "../../../supabase-client";
import { StorageApiError } from "@supabase/storage-js";

/**
 * Uploads the file to storage via the /documents/upload endpoint using FormData.
 */
export async function uploadFileToDb(
	file: File,
	filePath: string,
): Promise<void> {
	try {
		const { error: uploadError } = await supabase.storage
			.from("public_documents")
			.upload(filePath, file);

		if (uploadError) {
			console.error("Storage upload error:", uploadError);
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
 * Processes the uploaded document via the /documents/process endpoint.
 */
export async function processDocument(
	file: File,
	filePath: string,
): Promise<void> {
	const { session } = useAuthStore.getState();
	const access_group_id = useAccessGroupStore.getState().accessGroupId;

	const fileExtension = filePath.split(".").pop() ?? undefined;
	// Create document metadata
	const documentData = {
		document: {
			id: null,
			folder_id: null,
			owned_by_user_id: null,
			created_at: new Date().toISOString(),
			source_type: "public_document",
			source_url: filePath,
			access_group_id: access_group_id,
			uploaded_by_user_id: session?.user.id,
			metadata: {
				mimeType: file.type || fileExtension,
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
