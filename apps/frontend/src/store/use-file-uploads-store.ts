import { create } from "zustand";
import { useUserDocumentStore } from "./use-user-document-store.ts";
import { uploadAndProcessDocument } from "../api/documents/upload-file.ts";
import { useErrorStore } from "./error-store.ts";
import * as Sentry from "@sentry/react";
import type { Span } from "@sentry/react";
import { isSupportedUploadFile } from "../lib/upload-file-types.ts";

export const UPLOAD_STATUS_MAP = {
	waiting: "Warte",
	uploading: "Hochladen läuft",
	processing: "Verarbeitung läuft",
	successful: "Bereit zur Nutzung",
	canceled: "Hochladen abgebrochen",
	"failed.generic": "Hochladen fehlgeschlagen",
	"failed.duplicate": "Datei existiert bereits",
	"failed.format": "Falsches Format",
	"failed.size": `Datei zu groß`,
	"failed.tooMany": `Uploadlimit erreicht`,
} as const;

export type UploadStatusKeys = keyof typeof UPLOAD_STATUS_MAP;

export type FileUpload = {
	id: string;
	file: File;
	status: UploadStatusKeys;
	existingFileName?: string;
};

const SUCCESSFUL_UPLOAD_REMOVAL_DELAY_MS = 10_000;

type UseFileUploadsStore = {
	fileUploads: FileUpload[];
	uploadFile: (args: { fileUpload: FileUpload; span: Span }) => Promise<void>;
	uploadFiles: (files: File[]) => Promise<void>;
	isUploadingOver: () => boolean;
	hasAvailableUploadSlots: () => boolean;
	updateFileUploadStatus: (
		id: string,
		status: UploadStatusKeys,
		existingFileName?: string,
	) => void;
	removeFileUpload: (id: string) => void;
	clearFileUploads: () => void;
};

export const useFileUploadsStore = create<UseFileUploadsStore>((set, get) => ({
	fileUploads: [],

	async uploadFile({ fileUpload: { id, file }, span }) {
		const { updateFileUploadStatus } = get();
		const { getUserDocuments, selectUserChatDocument } =
			useUserDocumentStore.getState();

		const uploadFileSizeLimit = import.meta.env.VITE_UPLOAD_FILE_SIZE_LIMIT_MB;

		try {
			if (file.size > uploadFileSizeLimit * 1024 * 1024) {
				throw new Error("failed.size");
			}

			if (!isSupportedUploadFile(file)) {
				throw new Error("failed.format");
			}

			const documentId = await uploadAndProcessDocument(
				file,
				(status, existingFileName) =>
					updateFileUploadStatus(id, status, existingFileName),
			);

			await getUserDocuments(new AbortController().signal);

			const uploadedDocument = useUserDocumentStore
				.getState()
				.userDocuments.find((doc) => doc.id === documentId);

			if (uploadedDocument) {
				selectUserChatDocument(uploadedDocument);
			}

			updateFileUploadStatus(id, "successful");

			setTimeout(() => {
				get().removeFileUpload(id);
			}, SUCCESSFUL_UPLOAD_REMOVAL_DELAY_MS);
		} catch (error) {
			useErrorStore.getState().handleError(error, span);

			if (isKnownError(error)) {
				updateFileUploadStatus(id, error.message);
				return;
			}

			updateFileUploadStatus(id, "failed.generic");
		}
	},

	uploadFiles: async (files: File[]) => {
		const { fileUploads, uploadFile } = get();
		const { userDocuments, deletedDefaultDocumentIds } =
			useUserDocumentStore.getState();

		const numberOfNewUploads = userDocuments.filter(
			(doc) => !deletedDefaultDocumentIds.includes(doc.id),
		).length;

		const numberOfActiveAndQueuedUploads =
			fileUploads.filter(isActiveOrQueued).length;

		let availableUploadSlots =
			Number(import.meta.env.VITE_MAX_TOTAL_FILES_UPLOADED) -
			numberOfNewUploads -
			numberOfActiveAndQueuedUploads;

		availableUploadSlots = Math.max(0, availableUploadSlots);

		const filesToUpload = files.slice(0, availableUploadSlots);
		const filesToCancel = files.slice(availableUploadSlots);

		const newFileUploads = filesToUpload.map((file) => ({
			id: crypto.randomUUID(),
			file,
			status: "waiting" as UploadStatusKeys,
		}));

		const canceledFileUploads = filesToCancel.map((file) => ({
			id: crypto.randomUUID(),
			file,
			status: "failed.tooMany" as UploadStatusKeys,
		}));

		const previousFileUploads = fileUploads.filter(
			(upload) =>
				isActiveOrQueued(upload) ||
				!files.some(({ name }) => name === upload.file.name),
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
				fileUpload.status !== "uploading" && fileUpload.status !== "processing",
		);
	},

	hasAvailableUploadSlots: () => {
		const { fileUploads } = get();
		const maxFileUploads = Number(
			import.meta.env.VITE_MAX_PARALLEL_FILE_UPLOADS,
		);
		const activeUploads = fileUploads.filter(
			(fileUpload) =>
				fileUpload.status === "uploading" || fileUpload.status === "processing",
		);
		return activeUploads.length < maxFileUploads;
	},

	updateFileUploadStatus: (
		id: string,
		status: UploadStatusKeys,
		existingFileName?: string,
	) => {
		const { fileUploads } = get();

		const updatedFileUploads = fileUploads.map((fileUpload) => {
			if (fileUpload.id === id) {
				return {
					...fileUpload,
					status,
					existingFileName: existingFileName ?? fileUpload.existingFileName,
				};
			}
			return fileUpload;
		});

		set({ fileUploads: updatedFileUploads });
	},

	removeFileUpload: (id: string) => {
		const { fileUploads } = get();
		set({
			fileUploads: fileUploads.filter((fileUpload) => fileUpload.id !== id),
		});
	},

	clearFileUploads: () => {
		set({ fileUploads: [] });
	},
}));

function isActiveOrQueued({ status }: FileUpload) {
	return (
		status === "waiting" || status === "uploading" || status === "processing"
	);
}

function isKnownError(error: unknown): error is { message: UploadStatusKeys } {
	return error instanceof Error && error.message in UPLOAD_STATUS_MAP;
}
