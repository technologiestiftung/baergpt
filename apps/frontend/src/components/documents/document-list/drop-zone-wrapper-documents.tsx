import React, { type ReactNode } from "react";
import { FolderIcon } from "../../primitives/icons/folder-icon.tsx";
import { useDropzone } from "react-dropzone";
import { useFileUploadsStore } from "../../../store/use-file-uploads-store.ts";
import { useFolderStore } from "../../../store/folder-store.ts";
import Content from "../../../content.ts";
import { useErrorStore } from "../../../store/error-store.ts";

export function DropZoneWrapperDocuments({
	children,
	className,
	style,
	isDropZoneDisabled = false,
	...divProps
}: {
	children: ReactNode;
	className?: string;
	style?: React.CSSProperties;
	isDropZoneDisabled?: boolean;
} & React.HTMLAttributes<HTMLDivElement>) {
	const { currentFolder } = useFolderStore();
	const { uploadFiles } = useFileUploadsStore();

	const onDrop = (acceptedFiles: File[]) => {
		if (isDropZoneDisabled) {
			return;
		}
		uploadFiles(acceptedFiles).catch(useErrorStore.getState().handleError);
	};

	const { getRootProps, getInputProps, isDragActive } = useDropzone({
		onDrop,
		noClick: true,
	});

	return (
		<div
			className={`relative ${className}`}
			id="drop-zone-file-upload"
			{...getRootProps()}
			style={style}
			{...divProps}
		>
			{!isDropZoneDisabled && (
				<>
					<input
						{...getInputProps()}
						accept={
							"application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
						}
						aria-label={Content["fileUpload.upload"]}
						aria-hidden="true"
					/>

					<div
						className={`absolute h-full text-lg w-full top-0 left-0 right-0 z-20 rounded-3px bg-hellblau-100/90 backdrop-blur-sm text-da flex flex-col items-center justify-center px-5 py-2 pointer-events-none 
					transition-opacity duration-200 ${isDragActive ? "opacity-100" : "opacity-0"}`}
					>
						<img
							src="/icons/upload-icon.svg"
							width={48}
							height={48}
							className="mb-3"
							alt={Content["fileUpload.uploadButton.imgAlt"]}
						/>
						<span className="font-bold">
							{Content["fileUpload.dropZone.label"]}
						</span>
						<span className="flex gap-x-2">
							<FolderIcon variant="darkblue" />
							{currentFolder === null
								? Content["documentsSection.mainFolder.label"]
								: currentFolder.name}
						</span>
					</div>
				</>
			)}
			{children}
		</div>
	);
}
