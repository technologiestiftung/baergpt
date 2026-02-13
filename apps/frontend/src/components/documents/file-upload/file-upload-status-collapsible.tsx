import { useState } from "react";
import { ChevronIcon } from "../../primitives/icons/chevron-icon.tsx";
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
			<div
				className={`bg-dunkelblau-100 hover:bg-dunkelblau-90 disabled:hover:bg-hellblau-60 py-2.5 px-2 rounded-t-3px focus-visible:outline-default flex gap-2 justify-center items-center w-full ${!isOpen && "rounded-b-3px"}`}
			>
				<button
					className="flex justify-between items-center w-full focus-visible:outline-default text-hellblau-30 text-sm leading-5 font-semibold "
					onClick={() => setIsOpen(!isOpen)}
					aria-expanded={isOpen}
				>
					<FileUploadButtonStatus />
					<span className="p-1">
						<ChevronIcon
							direction={isOpen ? "down" : "up"}
							color="hellblau-30"
							classname="size-6"
						/>
					</span>
				</button>

				{isUploadOver && (
					<button
						onClick={clearFileUploads}
						className="p-1 rounded-3px focus-visible:outline-default"
					>
						<CloseIcon variant="white" />
					</button>
				)}
			</div>
			{isOpen && <FileUploadList />}
		</div>
	);
}
