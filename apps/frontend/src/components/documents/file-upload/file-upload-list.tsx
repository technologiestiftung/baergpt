import { LoadingSpinnerIcon } from "../../primitives/icons/loading-spinner-icon.tsx";
import { GreenCheckIcon } from "../../primitives/icons/green-check-icon.tsx";
import { GreyXIcon } from "../../primitives/icons/grey-x-icon.tsx";
import { RedErrorIcon } from "../../primitives/icons/red-error-icon.tsx";
import {
	UPLOAD_STATUS_MAP,
	useFileUploadsStore,
} from "../../../store/use-file-uploads-store.ts";
import Content from "../../../content.ts";
import { DocumentIcon } from "../../primitives/icons/document-icon.tsx";
import { ClockIcon } from "../../primitives/icons/clock-icon.tsx";

export function FileUploadList() {
	const { fileUploads } = useFileUploadsStore();

	return (
		<ul className="overflow-y-auto max-h-[228px] relative rounded-b-3px">
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
								{status === "waiting" && <ClockIcon size="small" />}
							</span>
						</div>
					</li>
				))}
			</div>
		</ul>
	);
}
