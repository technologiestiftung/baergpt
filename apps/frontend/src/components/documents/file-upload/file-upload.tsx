import React, { useRef } from "react";
import { useFileUploadsStore } from "../../../store/use-file-uploads-store.ts";
import { FileUploadStatusCollapsible } from "./file-upload-status-collapsible.tsx";
import { NoFilesUploadZone } from "./no-files-upload-zone.tsx";
import { useDocumentStore } from "../../../store/document-store.ts";
import { useFolderStore } from "../../../store/folder-store.ts";
import Content from "../../../content.ts";
import { useErrorStore } from "../../../store/error-store.ts";

type FileUploadProps = {
	hasItems: boolean;
};

export const FileUpload: React.FC<FileUploadProps> = ({ hasItems }) => {
	const { fileUploads, uploadFiles } = useFileUploadsStore();
	const { isDocumentFirstLoad, isLoading } = useDocumentStore();
	const { isFolderFirstLoad } = useFolderStore();
	const isFirstLoading = isDocumentFirstLoad || isFolderFirstLoad;
	const fileInputRef = useRef<HTMLInputElement>(null);
	const { error } = useErrorStore.getState();

	const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
		const files = event.target.files;
		if (files && files.length > 0) {
			uploadFiles(Array.from(files)).catch(
				useErrorStore.getState().handleError,
			);
		}
	};

	const triggerFileInput = () => {
		if (fileInputRef.current) {
			fileInputRef.current.click();
		}
	};

	const amountOfFileUploads = fileUploads.length;
	const hasFileUploads = amountOfFileUploads > 0;
	const hasItemsOrHasFileUploads = hasItems || hasFileUploads;

	return (
		<div className={`flex flex-col w-full ${!hasItems && "h-full "}`}>
			{!hasItems && !error && (
				<div
					className={`flex w-full h-full ${hasFileUploads ? "py-8" : "pt-8"}`}
				>
					<input
						type="file"
						ref={fileInputRef}
						onChange={handleFileSelect}
						accept={
							"application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
						}
						aria-label={Content["fileUpload.upload"]}
						style={{ display: "none" }}
						multiple
					/>
					{!isFirstLoading && !isLoading && !error && (
						<NoFilesUploadZone onUploadClick={triggerFileInput} />
					)}
				</div>
			)}

			{hasItemsOrHasFileUploads && (
				<div className="bg-hellblau-50 flex flex-col gap-y-3 pt-6">
					{hasItems && (
						<button
							onClick={triggerFileInput}
							className="bg-hellblau-60 hover:bg-hellblau-100 p-2 rounded-3px focus-visible:outline-default flex gap-2 justify-center w-full"
						>
							<input
								type="file"
								ref={fileInputRef}
								onChange={handleFileSelect}
								accept={
									"application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
								}
								aria-label={Content["fileUpload.upload"]}
								style={{ display: "none" }}
								multiple
							/>
							{Content["fileUpload.uploadButton"]}
							<img
								src="/icons/upload-icon.svg"
								width={20}
								height={20}
								alt={Content["fileUpload.uploadButton.imgAlt"]}
							/>
						</button>
					)}

					{hasFileUploads && <FileUploadStatusCollapsible />}
				</div>
			)}
		</div>
	);
};
