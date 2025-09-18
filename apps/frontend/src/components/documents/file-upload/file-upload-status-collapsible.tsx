import { useState } from "react";
import { ChevronLargeIcon } from "../../primitives/icons/chevron-large-icon.tsx";
import { CloseIcon } from "../../primitives/icons/close-icon.tsx";
import { useFileUploadsStore } from "../../../store/use-file-uploads-store.ts";
import { FileUploadList } from "./file-upload-list.tsx";
import { FileUploadButtonStatus } from "./file-upload-button-status.tsx";

export function FileUploadStatusCollapsible() {
	const { fileUploads, clearFileUploads } = useFileUploadsStore();
	const [isOpen, setIsOpen] = useState(true);

	const isUploadOver = fileUploads.every(
		(fileUpload) => fileUpload.status !== "uploading",
	);

	return (
		<div className="flex flex-col w-full">
			<div className="flex w-full bg-hellblau-100 hover:bg-hellblau-60 px-4 py-1 rounded-3px">
				<button
					className="flex justify-between w-full rounded-3px py-1 focus-visible:outline-default"
					onClick={() => setIsOpen(!isOpen)}
					aria-expanded={isOpen}
				>
					<FileUploadButtonStatus />
					<span className="p-1">
						<ChevronLargeIcon direction={isOpen ? "down" : "up"} />
					</span>
				</button>

				{isUploadOver && (
					<button
						onClick={clearFileUploads}
						className="p-1 rounded-3px focus-visible:outline-default"
					>
						<CloseIcon />
					</button>
				)}
			</div>

			{isOpen && <FileUploadList />}
		</div>
	);
}
