import { DocumentProcessInput } from "../schemas/document-process-schema";
import { ValidationResult } from "../types/common";
import { DatabaseService } from "./database-service";

const dbService = new DatabaseService();

export class ValidationService {
	validatePersonalSourceUrlPath(
		sourceUrl: string,
		authenticatedUserId: string,
	): { valid: boolean; error?: string } {
		const pathPrefix = sourceUrl.split("/")[0];
		if (pathPrefix !== authenticatedUserId) {
			return {
				valid: false,
				error:
					"Unauthorized: source_url must be in your own storage folder for personal documents",
			};
		}
		return { valid: true };
	}

	validatePublicSourceUrlPath(
		sourceUrl: string,
		accessGroupId: string,
	): { valid: boolean; error?: string } {
		const pathPrefix = sourceUrl.split("/")[0];
		if (pathPrefix !== accessGroupId) {
			return {
				valid: false,
				error:
					"Unauthorized: source_url must match the access_group_id for public documents",
			};
		}
		return { valid: true };
	}
	async validateDocumentRequest(
		inputDocument: DocumentProcessInput["document"],
		authenticatedUserId: string,
	): Promise<ValidationResult> {
		const sourceUrl = inputDocument.source_url;
		const bucket =
			inputDocument.source_type === "personal_document"
				? "documents"
				: "public_documents";

		// Path validation
		if (inputDocument.source_type === "personal_document") {
			const pathValidation = this.validatePersonalSourceUrlPath(
				sourceUrl,
				authenticatedUserId,
			);
			if (!pathValidation.valid) {
				return { success: false, error: pathValidation.error, status: 403 };
			}
		} else {
			if (!inputDocument.access_group_id) {
				return {
					success: false,
					error: "access_group_id is required for public/default documents",
					status: 400,
				};
			}
			const pathValidation = this.validatePublicSourceUrlPath(
				sourceUrl,
				inputDocument.access_group_id,
			);
			if (!pathValidation.valid) {
				return { success: false, error: pathValidation.error, status: 403 };
			}
		}

		// Folder ownership validation
		if (inputDocument.folder_id != null) {
			const folderBelongsToUser = await dbService.validateFolderOwnership(
				inputDocument.folder_id,
				authenticatedUserId,
			);
			if (!folderBelongsToUser) {
				return {
					success: false,
					error:
						"Unauthorized: folder_id does not belong to the authenticated user",
					status: 403,
				};
			}
		}

		// File existence validation
		const fileExists = await dbService.validateFileExistsInStorage(
			sourceUrl,
			bucket,
		);
		if (!fileExists) {
			return {
				success: false,
				error: "File not found in storage at the specified source_url",
				status: 404,
			};
		}

		return { success: true, bucket };
	}
}
