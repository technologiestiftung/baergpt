import React from "react";
import { useDocumentStore } from "../../store/document-store";
import { CloseIcon } from "../primitives/icons/close-icon";
import Content from "../../content";

export const DocumentPreviewSection: React.FC = () => {
	const {
		selectedPreviewDocument,
		selectedPreviewDocumentPreviewUrl,
		selectedPreviewDocumentDownloadUrl,
		unselectPreviewDocument,
	} = useDocumentStore();

	const isDocxFormat = (fileName: string) => {
		return fileName.toLowerCase().split(".").pop() === "docx";
	};

	// Check if the file type can be previewed in browser
	const canPreviewInBrowser = (fileName: string) => {
		const extension = fileName.toLowerCase().split(".").pop();
		// PDFs and DOCX documents can be previewed in iframes
		return extension === "pdf" || extension === "docx";
	};

	if (!selectedPreviewDocument) {
		return null;
	}

	const hasSupportedPreview = canPreviewInBrowser(
		selectedPreviewDocument.file_name ?? "",
	);

	return (
		<section className="absolute h-full inset-0 z-30 flex flex-col bg-white">
			<div className="flex flex-col gap-2.5 md:gap-3 px-5 md:px-[88px] md:py-6 py-3">
				<div className="flex w-full justify-between gap-1 px-0 md:px-2.5">
					<h2 className="flex text-baseleading-6 md:text-xl md:leading-7 font-semibold break-all text-dunkelblau-200">
						{selectedPreviewDocument?.file_name}
					</h2>
					<button
						className="p-1 rounded-3px hover:bg-hellblau-60 focus-visible:outline-default flex-shrink-0 self-start"
						onClick={unselectPreviewDocument}
						aria-label="close-preview-section"
					>
						<CloseIcon />
					</button>
				</div>
				{selectedPreviewDocumentDownloadUrl && (
					<a
						href={selectedPreviewDocumentDownloadUrl}
						target="_blank"
						aria-label={`${selectedPreviewDocument?.file_name} ${Content["documentsPreviewSection.downloadLink.ariaLabel"]}`}
						download={selectedPreviewDocument?.file_name}
						className="flex rounded-3px h-9 w-fit items-center px-2 gap-1 hover:bg-hellblau-100 focus-visible:outline-default"
					>
						<span className="text-sm leading-5 font-normal">
							{Content["documentsPreviewSection.downloadLink.label"]}
						</span>
						<img
							src="/icons/download-icon.svg"
							width={20}
							height={20}
							alt={Content["downloadIcon.imgAlt"]}
						/>
					</a>
				)}
			</div>
			<div className="h-full w-full px-5 md:px-24 pt-7 md:pt-8 bg-hellblau-30 flex items-center justify-center flex-col">
				{!hasSupportedPreview && (
					<div className="flex items-center justify-center h-full text-center max-w-xl">
						<p className="text-lg text-dunkelblau-80">
							{Content["documentsPreviewSection.noPreviewAvailable"]}
						</p>
					</div>
				)}
				{selectedPreviewDocumentPreviewUrl && hasSupportedPreview && (
					<>
						<p
							className={`pb-5 text-sm leading-5 font-normal text-dunkelblau-80 
								${isDocxFormat(selectedPreviewDocument.file_name ?? "") ? "" : "hidden"}`}
						>
							{Content["documentsPreviewSection.disclaimer.docx"]}
						</p>
						<iframe
							key={selectedPreviewDocument.id}
							src={`${selectedPreviewDocumentPreviewUrl}#toolbar=0`}
							width="100%"
							height="100%"
							className="bg-white shadow-[0px_0px_12px_0px_rgba(3,8,18,0.25)]"
						/>
					</>
				)}
				{!selectedPreviewDocumentPreviewUrl && hasSupportedPreview && (
					<div className="flex items-center justify-center h-full text-center max-w-xl">
						<p className="text-lg text-dunkelblau-80">
							{Content["documentsPreviewSection.loadingPreview"]}
						</p>
					</div>
				)}
			</div>
		</section>
	);
};
