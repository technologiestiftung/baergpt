import { create } from "zustand";
import { useDocumentStore } from "./document-store.ts";
import { useAuthStore } from "./auth-store.ts";
import slugify from "slugify";
import {
	uploadFileToDb,
	processDocument,
} from "../api/documents/upload-file.ts";
import { useErrorStore } from "./error-store.ts";
import * as Sentry from "@sentry/react";
import type { Span } from "@sentry/react";

export const UPLOAD_STATUS_MAP = {
	waiting: "Warte",
	uploading: "Hochladen läuft",
	uploaded: "Erfolgreich hochgeladen",
	processing: "Hochladen läuft",
	successful: "Erfolgreich hochgeladen",
	canceled: "Hochladen abgebrochen",
	"failed.generic": "Hochladen fehlgeschlagen",
	"failed.duplicate": "Datei existiert bereits",
	"failed.format": "Falsches Format",
	"failed.size": `Datei zu groß`,
	"failed.tooMany": `Uploadlimit erreicht`,
} as const;

export type UploadStatusKeys = keyof typeof UPLOAD_STATUS_MAP;

export type FileUpload = {
	file: File;
	status: UploadStatusKeys;
};

const SUCCESSFUL_UPLOAD_REMOVAL_DELAY_MS = 10_000;

type UseFileUploadsStore = {
	fileUploads: FileUpload[];
	uploadFile: (args: { fileUpload: FileUpload; span: Span }) => Promise<void>;
	uploadFiles: (files: File[]) => Promise<void>;
	isUploadingOver: () => boolean;
	hasAvailableUploadSlots: () => boolean;
	updateFileUploadStatus: (file: File, status: UploadStatusKeys) => void;
	removeFileUpload: (fileName: string) => void;
	clearFileUploads: () => void;
};

function isKnownError(error: unknown): error is { message: UploadStatusKeys } {
	return error instanceof Error && error.message in UPLOAD_STATUS_MAP;
}

export const useFileUploadsStore = create<UseFileUploadsStore>((set, get) => ({
	fileUploads: [],

	async uploadFile({ fileUpload: { file }, span }) {
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

			await getDocuments(new AbortController().signal);
		} catch (error) {
			useErrorStore.getState().handleError(error, span);

			if (isKnownError(error)) {
				updateFileUploadStatus(file, error.message);
				return;
			}

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
		const { documents, deletedDefaultDocumentIds } =
			useDocumentStore.getState();

		const numberOfUploads = documents.filter(
			(doc) => !deletedDefaultDocumentIds.includes(doc.id),
		).length;

		const availableUploadSlots =
			Number(import.meta.env.VITE_MAX_TOTAL_FILES_UPLOADED) - numberOfUploads;

		const filesToUpload = files.slice(0, availableUploadSlots);
		const filesToCancel = files.slice(availableUploadSlots);

		const newFileUploads = filesToUpload.map((file) => ({
			file,
			status: "waiting" as UploadStatusKeys,
		}));

		const canceledFileUploads = filesToCancel.map((file) => ({
			file,
			status: "failed.tooMany" as UploadStatusKeys,
		}));

		const previousFileUploads = fileUploads.filter(
			({ file }) => !files.some(({ name }) => name === file.name),
		);

		const updatedFileUploads = [
			...previousFileUploads,
			...newFileUploads,
			...canceledFileUploads,
		];

		set({ fileUploads: updatedFileUploads });

		const MAX_PARALLEL = Number(import.meta.env.VITE_MAX_PARALLEL_FILE_UPLOADS);
		const queueState = { index: 0, activeUploads: 0 };

		await new Promise<void>((resolve) => {
			const processUploadQueue = () => {
				if (
					queueState.index >= newFileUploads.length &&
					queueState.activeUploads === 0
				) {
					resolve();
					return;
				}

				while (
					queueState.activeUploads < MAX_PARALLEL &&
					queueState.index < newFileUploads.length
				) {
					const fileUpload = newFileUploads[queueState.index++];
					queueState.activeUploads++;
					Sentry.startSpan(
						{ name: "File Upload", op: "file.upload" },
						async (span) => {
							await uploadFile({ fileUpload, span });
						},
					).finally(() => {
						queueState.activeUploads--;
						processUploadQueue();
					});
				}
			};

			processUploadQueue();
		});
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

	removeFileUpload: (fileName: string) => {
		const { fileUploads } = get();
		set({
			fileUploads: fileUploads.filter(({ file }) => file.name !== fileName),
		});
	},

	clearFileUploads: () => {
		set({ fileUploads: [] });
	},
}));
