import React from "react";
import { Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import {
	useFileUploadsStore,
	UPLOAD_STATUS_MAP,
} from "../../store/use-upload-document-store";
import Content from "../../content";

export const FileUploadStatus: React.FC = () => {
	const { fileUploads } = useFileUploadsStore();

	const amountOfUploadingFiles = fileUploads.filter(
		({ status }) =>
			status.includes("uploading") || status.includes("processing"),
	).length;

	const failedFiles = fileUploads.filter(({ status }) =>
		status.includes("failed"),
	);

	const hasFailedFiles = failedFiles.length > 0;
	const isUploadingOver =
		amountOfUploadingFiles === 0 && fileUploads.length > 0;

	// Uploading or processing
	if (!isUploadingOver) {
		return (
			<span className="flex items-center gap-x-2">
				<Loader2 className="size-4 animate-spin" />
				{amountOfUploadingFiles}{" "}
				{amountOfUploadingFiles > 1
					? Content["fileUploadButtonStatus.uploading"]
					: Content["fileUploadButtonStatus.singleFileUploading"]}
			</span>
		);
	}

	// All done, no failures
	if (!hasFailedFiles) {
		return (
			<span className="flex items-center gap-x-2">
				<CheckCircle className="size-4 text-green-500" />
				{Content["fileUploadButtonStatus.uploaded"]}
			</span>
		);
	}

	// Single failure — specific error
	if (failedFiles.length === 1) {
		const singleFailedFile = failedFiles[0];
		const specificErrorMessage = UPLOAD_STATUS_MAP[singleFailedFile.status];
		return (
			<span className="flex items-center gap-x-2">
				<AlertTriangle className="size-4 text-red-500" />
				{specificErrorMessage}
			</span>
		);
	}

	// Multiple failures — generic message
	return (
		<span className="flex items-center gap-x-2">
			<AlertTriangle className="size-4 text-red-500" />
			{failedFiles.length} {Content["fileUploadButtonStatus.failed"]}
		</span>
	);
};
