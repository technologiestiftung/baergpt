import { documentProcessSchema } from "../schemas/document-process-schema";
import { BaseContentDbService } from "./db-service/base-db-service";
import { config } from "../config";

const SUPPORTED_FILE_TYPES = [
	{ mimeType: "application/pdf", extensions: ["pdf"] },
	{
		mimeType:
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		extensions: ["docx"],
	},
	{
		mimeType:
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		extensions: ["xlsx"],
	},
	{ mimeType: "text/csv", extensions: ["csv"] },
	{ mimeType: "text/markdown", extensions: ["md", "markdown"] },
];

// .md often arrives as "", application/octet-stream or text/plain
function getSupportedFile(file: File) {
	const nameExtension = file.name.split(".").pop()?.toLowerCase() ?? "";
	const fileType =
		SUPPORTED_FILE_TYPES.find(({ mimeType }) => mimeType === file.type) ??
		SUPPORTED_FILE_TYPES.find(({ extensions }) =>
			extensions.includes(nameExtension),
		);

	if (!fileType) {
		return null;
	}

	return {
		fileExtension: fileType.extensions[0],
		file:
			file.type === fileType.mimeType
				? file
				: new File([file], file.name, {
						type: fileType.mimeType,
						lastModified: file.lastModified,
					}),
	};
}

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

		const supportedFile = getSupportedFile(file);

		if (!supportedFile) {
			throw new Error("failed.format", {
				cause: `file type ${file.type} of ${file.name} not supported`,
			});
		}

		const { fileExtension } = supportedFile;

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
			file: supportedFile.file,
		};
	}
}
