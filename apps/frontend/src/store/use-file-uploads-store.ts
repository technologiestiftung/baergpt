import { create } from "zustand";
import { useDocumentStore } from "./document-store.ts";
import { useAuthStore } from "./auth-store.ts";
import slugify from "slugify";
import {
	uploadFileToDb,
	processDocument,
} from "../api/documents/upload-file.ts";
import { useErrorStore } from "./error-store.ts";
export const UPLOAD_STATUS_MAP = {
	uploading: "wird hochgeladen",
	uploaded: "erfolgreich hochgeladen",
	processing: "wird verarbeitet",
	successful: "erfolgreich verarbeitet",
	canceled: "hochladen abgebrochen",
	"failed.generic": "hochladen fehlgeschlagen",
	"failed.duplicate": "Datei existiert bereits",
	"failed.format": "Ungültiges Dateiformat (nur PDF, Word oder Excel)",
	"failed.size": `Datei zu groß (max. ${import.meta.env.VITE_UPLOAD_FILE_SIZE_LIMIT_MB} MB)`,
} as const;

export type UploadStatusKeys = keyof typeof UPLOAD_STATUS_MAP;

export type FileUpload = {
	file: File;
	status: UploadStatusKeys;
};

type UseFileUploadsStore = {
	fileUploads: FileUpload[];
	uploadFile: (fileUpload: FileUpload) => Promise<void>;
	uploadFiles: (files: File[]) => Promise<void>;
	isUploadingOver: () => boolean;
	updateFileUploadStatus: (file: File, status: UploadStatusKeys) => void;
	clearFileUploads: () => void;
};

function isKnownError(error: unknown): error is { message: UploadStatusKeys } {
	return error instanceof Error && error.message in UPLOAD_STATUS_MAP;
}

export const useFileUploadsStore = create<UseFileUploadsStore>((set, get) => ({
	fileUploads: [],

	async uploadFile({ file }: FileUpload) {
		const { updateFileUploadStatus } = get();
		const { session } = useAuthStore.getState();
		const { documents, getDocuments, deleteDocument } =
			useDocumentStore.getState();

		const uploadFileSizeLimit = import.meta.env.VITE_UPLOAD_FILE_SIZE_LIMIT_MB;
		const slugifiedFilename = slugify(file.name, { lower: true });
		const filePath = `${session?.user.id}/${slugifiedFilename}`;
		try {
			if (file.size > uploadFileSizeLimit * 1024 * 1024) {
				throw new Error("failed.size");
			}

			const fileExists = documents.some((doc) => doc.source_url === filePath);
			if (fileExists) {
				throw new Error("failed.duplicate");
			}

			if (
				!file.type.includes("pdf") &&
				!file.type.includes("msword") &&
				!file.type.includes(
					"vnd.openxmlformats-officedocument.wordprocessingml.document",
				) &&
				!file.type.includes(
					"vnd.openxmlformats-officedocument.spreadsheetml.sheet",
				)
			) {
				throw new Error("failed.format");
			}

			updateFileUploadStatus(file, "uploading");
			await uploadFileToDb(file, filePath);
			updateFileUploadStatus(file, "uploaded");

			updateFileUploadStatus(file, "processing");
			await processDocument(file, filePath);
			updateFileUploadStatus(file, "successful");

			getDocuments(new AbortController().signal).catch(
				useErrorStore.getState().handleError,
			);
		} catch (error) {
			useErrorStore.getState().handleError(error);
			if (isKnownError(error)) {
				updateFileUploadStatus(file, error.message);
				return;
			}
			console.error(error);
			updateFileUploadStatus(file, "failed.generic");
			// If the document processing fails, remove the document from the store
			const documentToDelete = documents.find(
				(doc) => doc.source_url === filePath,
			);
			if (documentToDelete) {
				await deleteDocument(documentToDelete.id);
			}
		}
	},

	uploadFiles: async (files: File[]) => {
		const { fileUploads, uploadFile } = get();

		const newFileUploads = files.map((file) => ({
			file,
			status: "uploading" as UploadStatusKeys,
		}));

		const updatedFileUploads = [...fileUploads, ...newFileUploads];

		set({ fileUploads: updatedFileUploads });

		const promises = newFileUploads.map((fileUpload) => uploadFile(fileUpload));
		await Promise.all(promises);
	},

	isUploadingOver: () => {
		const { fileUploads } = get();
		return fileUploads.every(
			(fileUpload) =>
				fileUpload.status !== "uploading" &&
				fileUpload.status !== "processing" &&
				fileUpload.status !== "uploaded",
		);
	},

	updateFileUploadStatus: (file: File, status: UploadStatusKeys) => {
		const { fileUploads } = get();

		const updatedFileUploads = fileUploads.map((fileUpload) => {
			if (fileUpload.file.name === file.name) {
				return {
					...fileUpload,
					status,
				};
			}
			return fileUpload;
		});

		set({ fileUploads: updatedFileUploads });
	},

	clearFileUploads: () => {
		set({ fileUploads: [] });
	},
}));
