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
	uploading: "Hochladen läuft",
	uploaded: "Erfolgreich hochgeladen",
	processing: "Hochladen läuft",
	successful: "Erfolgreich hochgeladen",
	canceled: "Hochladen abgebrochen",
	"failed.generic": "Hochladen fehlgeschlagen",
	"failed.duplicate": "Datei existiert bereits",
	"failed.format": "Falsches Format",
	"failed.size": `Datei zu groß`,
	"failed.tooMany": `Hochladen fehlgeschlagen`,
} as const;

export type UploadStatusKeys = keyof typeof UPLOAD_STATUS_MAP;

export type FileUpload = {
	file: File;
	status: UploadStatusKeys;
};

const SUCCESSFUL_UPLOAD_REMOVAL_DELAY_MS = 10_000;
const WARNING_AUTO_DISMISS_DELAY_MS = 10_000;

let maxParallelUploadWarningTimeout: ReturnType<typeof setTimeout> | null =
	null;

type UseFileUploadsStore = {
	fileUploads: FileUpload[];
	isMaxParallelUploadWarningDismissed: boolean;
	uploadFile: (fileUpload: FileUpload) => Promise<void>;
	uploadFiles: (files: File[]) => Promise<void>;
	isUploadingOver: () => boolean;
	hasAvailableUploadSlots: () => boolean;
	updateFileUploadStatus: (file: File, status: UploadStatusKeys) => void;
	removeFileUpload: (fileName: string) => void;
	clearFileUploads: () => void;
	startMaxParallelUploadWarningTimer: () => void;
	hideMaxParallelUploadWarning: () => void;
};

function isKnownError(error: unknown): error is { message: UploadStatusKeys } {
	return error instanceof Error && error.message in UPLOAD_STATUS_MAP;
}

export const useFileUploadsStore = create<UseFileUploadsStore>((set, get) => ({
	fileUploads: [],
	isMaxParallelUploadWarningDismissed: false,

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

			setTimeout(() => {
				get().removeFileUpload(file.name);
			}, SUCCESSFUL_UPLOAD_REMOVAL_DELAY_MS);

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
		const { fileUploads, uploadFile, hideMaxParallelUploadWarning } = get();
		const { documents } = useDocumentStore.getState();

		const availableUploadSlots =
			Number(import.meta.env.VITE_MAX_TOTAL_FILES_UPLOADED) - documents.length;
		const maxFileUploads = Math.min(
			availableUploadSlots,
			Number(import.meta.env.VITE_MAX_PARALLEL_FILE_UPLOADS),
		);

		const filesToUpload = files.slice(0, maxFileUploads);
		const filesToCancel = files.slice(maxFileUploads);

		const newFileUploads = filesToUpload.map((file) => ({
			file,
			status: "uploading" as UploadStatusKeys,
		}));

		const canceledFileUploads = filesToCancel.map((file) => ({
			file,
			status: "failed.tooMany" as UploadStatusKeys,
		}));

		const updatedFileUploads = [
			...fileUploads,
			...newFileUploads,
			...canceledFileUploads,
		];

		set({ fileUploads: updatedFileUploads });

		hideMaxParallelUploadWarning();

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

	hasAvailableUploadSlots: () => {
		const { fileUploads } = get();
		const maxFileUploads = Number(
			import.meta.env.VITE_MAX_PARALLEL_FILE_UPLOADS,
		);
		const activeUploads = fileUploads.filter(
			(fileUpload) =>
				fileUpload.status === "uploading" ||
				fileUpload.status === "processing" ||
				fileUpload.status === "uploaded",
		);
		return activeUploads.length < maxFileUploads;
	},

	updateFileUploadStatus: (file: File, status: UploadStatusKeys) => {
		const {
			fileUploads,
			isMaxParallelUploadWarningDismissed,
			startMaxParallelUploadWarningTimer,
		} = get();

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

		const shouldStartWarningTimer =
			status === "successful" &&
			updatedFileUploads.some(
				(fileUpload) => fileUpload.status === "failed.tooMany",
			) &&
			!isMaxParallelUploadWarningDismissed &&
			!maxParallelUploadWarningTimeout;

		if (shouldStartWarningTimer) {
			startMaxParallelUploadWarningTimer();
		}
	},

	removeFileUpload: (fileName: string) => {
		const { fileUploads } = get();
		set({
			fileUploads: fileUploads.filter(({ file }) => file.name !== fileName),
		});
	},

	clearFileUploads: () => {
		set({ fileUploads: [] });
	},

	startMaxParallelUploadWarningTimer: () => {
		// Clear existing timer
		if (maxParallelUploadWarningTimeout) {
			clearTimeout(maxParallelUploadWarningTimeout);
		}

		// Start new timer
		maxParallelUploadWarningTimeout = setTimeout(() => {
			maxParallelUploadWarningTimeout = null;
			set({ isMaxParallelUploadWarningDismissed: true });
		}, WARNING_AUTO_DISMISS_DELAY_MS);
	},

	hideMaxParallelUploadWarning: () => {
		if (maxParallelUploadWarningTimeout) {
			clearTimeout(maxParallelUploadWarningTimeout);
			maxParallelUploadWarningTimeout = null;
		}
		set({ isMaxParallelUploadWarningDismissed: false });
	},
}));
