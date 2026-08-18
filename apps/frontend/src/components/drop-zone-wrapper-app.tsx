import { type ReactNode } from "react";
import { useDropzone } from "react-dropzone";
import { useFileUploadsStore } from "../store/use-file-uploads-store.ts";
import { useCurrentFolderStore } from "../store/use-current-folder-store.ts";
import { useUserDocumentStore } from "../store/use-user-document-store.ts";
import { useErrorStore } from "../store/error-store.ts";
import { AddToChatIcon } from "./primitives/icons/add-to-chat-icon.tsx";
import Content from "../content.ts";
import { isPublicFolder } from "./documents/document-list/list-item/utils/is-public-folder.ts";
import type { Document, PublicFolder, UserFolder } from "../common.ts";

export function DropZoneWrapperApp({ children }: { children: ReactNode }) {
	const { currentFolder } = useCurrentFolderStore();
	const { uploadFiles, hasAvailableUploadSlots } = useFileUploadsStore();
	const { userDocuments, deletedDefaultDocumentIds } = useUserDocumentStore();

	const isDropZoneDisabled = isUploadDisabled({
		userDocuments,
		deletedDefaultDocumentIds,
		hasAvailableUploadSlots,
		currentFolder,
	});

	const onDrop = (acceptedFiles: File[]) => {
		if (isDropZoneDisabled) {
			return;
		}
		uploadFiles(acceptedFiles).catch(useErrorStore.getState().handleError);
	};

	const { getRootProps, getInputProps, isDragActive } = useDropzone({
		onDrop,
		noClick: true,
		disabled: isDropZoneDisabled,
		accept: {
			"application/pdf": [],
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document":
				[],
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [],
			"text/csv": [],
		},
	});

	return (
		<div
			className="relative h-full w-full"
			id="drop-zone-file-upload"
			{...getRootProps()}
		>
			{!isDropZoneDisabled && (
				<>
					<input
						{...getInputProps()}
						aria-label={Content["fileUpload.upload"]}
						aria-hidden="true"
					/>

					<div
						className={`absolute inset-0 z-40 bg-hellblau-100/90 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-none transition-opacity duration-200 ${isDragActive ? "opacity-100" : "opacity-0"} text-dunkelblau-100`}
					>
						<AddToChatIcon size={48} />
						<span className="font-bold mt-3 text-lg text-center px-5">
							{Content["chat.dropZone.label"]}
						</span>
					</div>
				</>
			)}
			{children}
		</div>
	);
}

function isUploadDisabled(args: {
	userDocuments: Document[];
	deletedDefaultDocumentIds: number[];
	hasAvailableUploadSlots: () => boolean;
	currentFolder: UserFolder | PublicFolder | null;
}) {
	const {
		userDocuments,
		deletedDefaultDocumentIds,
		hasAvailableUploadSlots,
		currentFolder,
	} = args;

	const numberOfUploads =
		userDocuments.filter((doc) => !deletedDefaultDocumentIds.includes(doc.id))
			.length || 0;
	const hasReachedTotalUploadLimit =
		numberOfUploads >= Number(import.meta.env.VITE_MAX_TOTAL_FILES_UPLOADED);

	return (
		hasReachedTotalUploadLimit ||
		!hasAvailableUploadSlots() ||
		isPublicFolder(currentFolder)
	);
}
