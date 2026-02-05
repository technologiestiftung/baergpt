import { LoadingSpinnerIcon } from "../../primitives/icons/loading-spinner-icon.tsx";
import { GreenCheckIcon } from "../../primitives/icons/green-check-icon.tsx";
import { GreyXIcon } from "../../primitives/icons/grey-x-icon.tsx";
import { RedErrorIcon } from "../../primitives/icons/red-error-icon.tsx";
import {
	UPLOAD_STATUS_MAP,
	useFileUploadsStore,
} from "../../../store/use-file-uploads-store.ts";
import Content from "../../../content.ts";
import { useDocumentStore } from "../../../store/document-store.ts";
import { DocumentIcon } from "../../primitives/icons/document-icon.tsx";

export function FileUploadList() {
	const { fileUploads, isMaxParallelUploadWarningDismissed } =
		useFileUploadsStore();
	const { documents, deletedDefaultDocumentIds } = useDocumentStore();

	const hasExceededParallelUploadLimit = fileUploads.some(
		(fileUpload) => fileUpload.status === "failed.tooMany",
	);

	const numberOfUploads =
		documents?.filter((doc) => !deletedDefaultDocumentIds.includes(doc.id))
			.length || 0;

	// Only show the warning when the user still has all parallel upload slots available.
	// Once they have fewer slots remaining, hide the warning to avoid confusion.
	const maxTotalFiles = Number(import.meta.env.VITE_MAX_TOTAL_FILES_UPLOADED);
	const maxParallelUploads = Number(
		import.meta.env.VITE_MAX_PARALLEL_FILE_UPLOADS,
	);
	const remainingSlots = maxTotalFiles - numberOfUploads;

	const isParallelUploadLimitWarningVisible =
		remainingSlots >= maxParallelUploads;

	return (
		<ul className="overflow-y-auto max-h-[228px] relative rounded-b-3px">
			{isParallelUploadLimitWarningVisible &&
				hasExceededParallelUploadLimit &&
				!isMaxParallelUploadWarningDismissed && (
					<div className="border-y-[0.5px] border-dunkelblau-80 w-full p-2.5 bg-dunkelblau-100 text-sm leading-5 font-semibold text-warning-100 z-10 sticky top-0">
						{`${Content["fileUpload.maxFilesWarning.p1"]} ${import.meta.env.VITE_MAX_PARALLEL_FILE_UPLOADS} ${Content["fileUpload.maxFilesWarning.p2"]}`}
					</div>
				)}
			<div className="flex flex-col py-1 px-2.5 bg-dunkelblau-100 rounded-b-3px">
				{fileUploads.map(({ file, status }) => (
					<li
						key={file.name}
						className="flex justify-between w-full items-center py-2 gap-x-2.5 overflow-hidden"
					>
						<div className="flex justify-between gap-x-2.5 items-center min-w-0 w-full">
							<span className="flex items-center gap-2 min-w-0 flex-1 truncate text-hellblau-30">
								<DocumentIcon variant="white" className="size-3.5 shrink-0" />
								<span className="truncate text-sm leading-5 font-normal min-w-0">
									{file.name}
								</span>
							</span>
							<span className="flex gap-x-2.5 items-center shrink-0">
								{/* Status */}
								{status.includes("failed") ? (
									<a
										href={Content["fileUpload.helpLink.link"]}
										className="text-[10px] leading-4 text-hellblau-30 underline underline-offset-2"
										aria-label={Content["fileUpload.helpLink.ariaLabel"]}
										target="_blank"
										rel="noopener noreferrer"
									>
										{UPLOAD_STATUS_MAP[status]}
									</a>
								) : (
									<span className="text-[10px] leading-4 text-hellblau-30">
										{UPLOAD_STATUS_MAP[status]}
									</span>
								)}
								{/* Icons */}
								{(status === "uploading" ||
									status === "processing" ||
									status === "uploaded") && (
									<LoadingSpinnerIcon variant="disabled" size="small" />
								)}
								{status === "successful" && <GreenCheckIcon size="small" />}
								{status === "canceled" && <GreyXIcon size="small" />}
								{status.includes("failed") && <RedErrorIcon size="small" />}
							</span>
						</div>
					</li>
				))}
			</div>
		</ul>
	);
}
