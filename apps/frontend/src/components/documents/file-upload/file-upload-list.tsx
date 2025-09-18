import { LoadingSpinnerIcon } from "../../primitives/icons/loading-spinner-icon.tsx";
import { GreenCheckIcon } from "../../primitives/icons/green-check-icon.tsx";
import { GreyXIcon } from "../../primitives/icons/grey-x-icon.tsx";
import { YellowExclamationMarkIcon } from "../../primitives/icons/yellow-exclamation-mark-icon.tsx";
import {
	UPLOAD_STATUS_MAP,
	useFileUploadsStore,
} from "../../../store/use-file-uploads-store.ts";
import Content from "../../../content.ts";

export function FileUploadList() {
	const { fileUploads } = useFileUploadsStore();

	return (
		<ul className="overflow-scroll max-h-[120px]">
			<div className="flex flex-col gap-y-3.5 pt-6 pb-4 bg-white rounded-b-3px">
				{fileUploads.map(({ file, status }) => (
					<li
						key={file.name}
						className="flex justify-between w-full items-center px-4 gap-x-3"
					>
						<span className="flex gap-x-2.5 items-center min-w-0 truncate">
							{(status === "uploading" ||
								status === "processing" ||
								status === "uploaded") && <LoadingSpinnerIcon />}
							{status === "successful" && <GreenCheckIcon />}
							{status === "canceled" && <GreyXIcon />}
							{status.includes("failed") && <YellowExclamationMarkIcon />}

							<span className="flex flex-col truncate">
								<span className="truncate">{file.name}</span>
								<span className="text-sm text-dunkelblau-40">
									{UPLOAD_STATUS_MAP[status]}
								</span>
							</span>
						</span>

						{status.includes("failed") && (
							<a
								href={Content["fileUpload.helpLink.link"]}
								className="flex rounded-3px h-9 w-fit items-center px-2.5 gap-2 bg-hellblau-60 hover:bg-hellblau-100 focus-visible:outline-default"
								aria-label={Content["fileUpload.helpLink.ariaLabel"]}
								target="_blank"
								rel="noopener noreferrer"
							>
								{Content["fileUpload.helpLink.label"]}
							</a>
						)}
					</li>
				))}
			</div>
		</ul>
	);
}
