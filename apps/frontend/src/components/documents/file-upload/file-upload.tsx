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
	const { fileUploads, uploadFiles, hasAvailableUploadSlots } =
		useFileUploadsStore();
	const {
		isDocumentFirstLoad,
		isLoading,
		documents,
		deletedDefaultDocumentIds,
	} = useDocumentStore();
	const { isFolderFirstLoad } = useFolderStore();
	const isFirstLoading = isDocumentFirstLoad || isFolderFirstLoad;
	const fileInputRef = useRef<HTMLInputElement>(null);
	const { error } = useErrorStore.getState();

	const numberOfUploads =
		documents?.filter((doc) => !deletedDefaultDocumentIds.includes(doc.id))
			.length || 0;
	const hasReachedTotalUploadLimit =
		numberOfUploads >= Number(import.meta.env.VITE_MAX_TOTAL_FILES_UPLOADED);

	const isUploadDisabled =
		!hasAvailableUploadSlots() || hasReachedTotalUploadLimit;

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
		<div className={`flex flex-col w-full ${!hasItems && "h-full"}`}>
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
					{hasFileUploads ? (
						<FileUploadStatusCollapsible />
					) : (
						hasItems && (
							<button
								onClick={triggerFileInput}
								className="bg-dunkelblau-100 hover:bg-dunkelblau-90 disabled:bg-dunkelblau-40 py-2.5 px-2 rounded-3px focus-visible:outline-default flex gap-2 justify-center items-center w-full"
								disabled={isUploadDisabled}
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
								<img
									src="/icons/upload-light-icon.svg"
									width={24}
									height={24}
									alt=""
								/>
								<span className="text-sm leading-5 font-semibold text-hellblau-30 disabled:text-dunkelblau-40">
									{Content["fileUpload.uploadButton"]}
								</span>
							</button>
						)
					)}

					<div className="text-sm leading-5 font-normal  text-center">
						{hasReachedTotalUploadLimit ? (
							<div className="text-warning-100">
								<p>{`${Content["fileUpload.infoMessage.limitReached.p1"]} ${import.meta.env.VITE_MAX_TOTAL_FILES_UPLOADED} ${Content["fileUpload.infoMessage.limitReached.p2"]}`}</p>
								<p>{Content["fileUpload.infoMessage.limitReached.p3"]}</p>
							</div>
						) : (
							<div className="text-dunkelblau-80">
								<p className="hidden md:block">
									{`${numberOfUploads} ${Content["fileUpload.infoMessage.counter.p1"]} ${import.meta.env.VITE_MAX_TOTAL_FILES_UPLOADED} ${Content["fileUpload.infoMessage.counter.p2"]}`}
								</p>
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
};
