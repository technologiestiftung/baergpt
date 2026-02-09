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

	return (
		<span className="flex gap-x-2 items-center">
			<RedErrorIcon />
			{UPLOAD_STATUS_MAP["failed.generic"]}
		</span>
	);
}
