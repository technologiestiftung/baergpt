import { LoadingSpinnerIcon } from "../../primitives/icons/loading-spinner-icon.tsx";
import { GreenCheckIcon } from "../../primitives/icons/green-check-icon.tsx";
import { RedErrorIcon } from "../../primitives/icons/red-error-icon.tsx";
import {
	useFileUploadsStore,
	UPLOAD_STATUS_MAP,
} from "../../../store/use-file-uploads-store.ts";
import Content from "../../../content.ts";

export function FileUploadButtonStatus() {
	const { fileUploads, isUploadingOver } = useFileUploadsStore();

	const failedFiles = fileUploads.filter(({ status }) =>
		status.includes("failed"),
	);
	const hasFailedFiles = failedFiles.length > 0;

	if (!isUploadingOver()) {
		return (
			<span className="flex gap-x-2 items-center">
				<LoadingSpinnerIcon variant="disabled" />
				{Content["fileUploadButtonStatus.uploading"]}
			</span>
		);
	}

	if (!hasFailedFiles) {
		return (
			<span className="flex gap-x-2 items-center">
				<GreenCheckIcon />
				{Content["fileUploadButtonStatus.uploaded"]}
			</span>
		);
	}

	// Show specific error message for single file failures, or generic for multiple
	if (failedFiles.length === 1) {
		const singleFailedFile = failedFiles[0];
		const specificErrorMessage = UPLOAD_STATUS_MAP[singleFailedFile.status];

		return (
			<span className="flex gap-x-2 items-center">
				<RedErrorIcon />
				{specificErrorMessage}
			</span>
		);
	}

	// Multiple files failed - show generic message with count
	return (
		<span className="flex gap-x-2 items-center">
			<RedErrorIcon />
			{failedFiles.length} {Content["fileUploadButtonStatus.failed"]}
		</span>
	);
}
