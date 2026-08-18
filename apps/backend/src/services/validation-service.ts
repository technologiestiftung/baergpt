import { documentProcessSchema } from "../schemas/document-process-schema";
import { BaseContentDbService } from "./db-service/base-db-service";
import { config } from "../config";

const EXTENSION_BY_MIME: Record<string, string> = {
	"application/pdf": "pdf",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document":
		"docx",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
	"text/csv": "csv",
};

export class ValidationService {
	private readonly dbService: BaseContentDbService;
	constructor(dbService: BaseContentDbService) {
		this.dbService = dbService;
	}

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
	async validateDocumentRequest({
		body,
		userId,
	}: {
		body: Record<string, string | File>;
		userId: string;
	}) {
		const file = body["file"];

		if (!(file instanceof File)) {
			throw new Error("failed.format", { cause: "file not instance of File" });
		}

		const maxSize = config.fileUploadLimitMb * 1024 * 1024;

		if (file.size > maxSize) {
			throw new Error("failed.size", {
				cause: `File is too big ${file.size} (max allowed is ${maxSize})`,
			});
		}

		const fileExtension = EXTENSION_BY_MIME[file.type];

		if (!fileExtension) {
			throw new Error("failed.format", {
				cause: `file extension ${file.type} not supported`,
			});
		}

		const metadata = body["metadata"];

		if (typeof metadata !== "string") {
			throw new Error("metadata not a string");
		}

		const parseResult = documentProcessSchema.parse(JSON.parse(metadata));

		const {
			document: { sourceType, accessGroupId, folderId },
			llmModel,
		} = parseResult;

		const prefix = sourceType === "personal_document" ? userId : accessGroupId;
		const sourceUrl = `${prefix}/${crypto.randomUUID()}.${fileExtension}`;
		const createdAt = new Date().toISOString();

		const bucket =
			sourceType === "personal_document" ? "documents" : "public_documents";

		// Path validation
		if (sourceType === "personal_document") {
			const pathValidation = this.validatePersonalSourceUrlPath(
				sourceUrl,
				userId,
			);
			if (!pathValidation.valid) {
				throw new Error(pathValidation.error);
			}
		} else {
			if (!accessGroupId) {
				throw new Error(
					"access_group_id is required for public/default documents",
				);
			}
			const pathValidation = this.validatePublicSourceUrlPath(
				sourceUrl,
				accessGroupId,
			);
			if (!pathValidation.valid) {
				throw new Error(pathValidation.error);
			}
		}

		// Folder ownership validation
		if (folderId !== null) {
			const folderBelongsToUser = await this.dbService.validateFolderOwnership(
				folderId,
				userId,
			);
			if (!folderBelongsToUser) {
				throw new Error(
					"Unauthorized: folder_id does not belong to the authenticated user",
				);
			}
		}

		return {
			sourceUrl,
			sourceType,
			folderId,
			createdAt,
			accessGroupId,
			llmModel,
			bucket,
			file,
		};
	}
}
