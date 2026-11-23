/* eslint-disable no-console */
import { PrivilegedDbService } from "../../src/services/db-service/privileged-db-service";
import { serviceRoleDbClient } from "../../src/supabase";

export const defaultDocumentSourceType = "default_document";
export const defaultDocumentsBucket = "public_documents";

export type ExistingDocument = {
	id: number;
	source_url: string;
	file_checksum: string | null;
	processing_finished_at: string | null;
};

/**
 * Swaps in the new version in one transaction (see `replace_default_document`),
 * then deletes the previous files from storage.
 */
export async function replaceDefaultDocument(
	newDocumentId: number,
	previousDocuments: ExistingDocument[],
): Promise<void> {
	const { error } = await serviceRoleDbClient.rpc("replace_default_document", {
		p_new_document_id: newDocumentId,
		p_old_document_ids: previousDocuments.map(({ id }) => id),
	});

	if (error) {
		throw error;
	}

	if (previousDocuments.length === 0) {
		return;
	}

	const dbService = new PrivilegedDbService(serviceRoleDbClient);
	for (const { source_url } of previousDocuments) {
		try {
			await dbService.deleteFileFromStorage(source_url, defaultDocumentsBucket);
		} catch (storageError) {
			// The document is already replaced, so only the file is left behind
			console.error(
				`Failed to delete previous file ${defaultDocumentsBucket}/${source_url}, remove it manually:`,
				storageError,
			);
		}
	}

	console.log(
		`Replaced previous version(s) of the document: ${previousDocuments.map(({ id }) => id).join(", ")}`,
	);
}
