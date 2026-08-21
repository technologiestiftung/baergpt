import React from "react";
import { usePreviewDocumentStore } from "../../store/use-preview-document-store.ts";
import { useErrorStore } from "../../store/error-store";
import { CloseIcon } from "../primitives/icons/close-icon";
import { SpreadsheetPreview } from "../spreadsheet/spreadsheet-preview.tsx";
import Content from "../../content";

export const DocumentPreviewSection: React.FC = () => {
	const {
		selectedPreviewDocument,
		selectedPreviewDocumentPreviewUrl,
		selectedPreviewDocumentDownloadUrl,
		isLoadingPreviewDocument,
		unselectPreviewDocument,
	} = usePreviewDocumentStore();

	const { getUIError } = useErrorStore();
	const errorMessage = getUIError("document-download");

	if (!selectedPreviewDocument) {
		return null;
	}

	const isDocxFormat = selectedPreviewDocument.file_name
		?.toLowerCase()
		.endsWith(".docx");

	const isSpreadsheet = [".xlsx", ".csv"].some((suffix) =>
		selectedPreviewDocument.file_name?.toLowerCase().endsWith(suffix),
	);

	return (
		<section className="absolute h-full inset-0 z-30 flex flex-col bg-hellblau-30">
			<div className="flex flex-col gap-4 md:gap-5 px-5 md:px-[60px] md:pt-6 md:pb-2 pb-1 pt-2.5">
				<div className="flex w-full justify-between gap-1">
					<h2 className="flex text-base leading-6 md:text-xl md:leading-7 font-semibold break-all text-dunkelblau-100">
						{selectedPreviewDocument?.file_name}
					</h2>
					<button
						className="p-1 rounded-3px hover:bg-hellblau-60 focus-visible:outline-default flex-shrink-0 self-start"
						onClick={unselectPreviewDocument}
						aria-label="close-preview-section"
					>
						<CloseIcon variant="darkBlue" />
					</button>
				</div>
				<div className="flex">
					{selectedPreviewDocumentDownloadUrl && (
						<a
							href={selectedPreviewDocumentDownloadUrl}
							target="_blank"
							aria-label={`${selectedPreviewDocument?.file_name} ${Content["documentsPreviewSection.downloadLink.ariaLabel"]}`}
							download={selectedPreviewDocument?.file_name}
							className="flex rounded-3px h-9 w-fit items-center px-2 gap-1 hover:bg-hellblau-100 focus-visible:outline-default"
						>
							<img
								src="/icons/download-icon.svg"
								width={20}
								height={20}
								alt={Content["downloadIcon.imgAlt"]}
							/>
							<span className="text-sm leading-5 font-normal text-dunkelblau-100">
								{Content["documentsPreviewSection.downloadLink.label"]}
							</span>
						</a>
					)}
					{errorMessage && (
						<p className="flex rounded-3px w-fit items-center px-0.5 py-1.5 gap-0.5">
							<img
								src="/icons/error-icon.svg"
								width={16}
								height={16}
								alt={Content["downloadIcon.imgAlt"]}
							/>
							<span className="text-sm leading-5 font-normal text-warning-100">
								{errorMessage}
							</span>
						</p>
					)}
				</div>
			</div>
			<div className="h-full w-full px-5 md:px-[60px] bg-hellblau-30 flex items-center justify-center flex-col">
				{isLoadingPreviewDocument && (
					<p className="text-lg text-dunkelblau-80">
						{Content["documentsPreviewSection.loadingPreview"]}
					</p>
				)}
				{!isLoadingPreviewDocument &&
					!isSpreadsheet &&
					selectedPreviewDocumentPreviewUrl && (
						<>
							<p
								className={`pb-5 text-sm leading-5 font-normal text-dunkelblau-80 ${isDocxFormat ? "" : "hidden"}`}
							>
								{Content["documentsPreviewSection.disclaimer.docx"]}
							</p>
							<div className="w-full h-full overflow-hidden relative shadow-md">
								<iframe
									key={selectedPreviewDocument.id}
									src={`${selectedPreviewDocumentPreviewUrl}#toolbar=0&view=fitH`}
									className="absolute -inset-1.5 w-[calc(100%+12px)] h-[calc(100%+12px)]"
									title={Content["documentsPreviewSection.title"]}
								/>
							</div>
						</>
					)}

				{!isLoadingPreviewDocument &&
					isSpreadsheet &&
					selectedPreviewDocumentPreviewUrl && (
						<div className="w-full h-full min-h-0 self-stretch py-2">
							<SpreadsheetPreview
								downloadUrl={selectedPreviewDocumentPreviewUrl}
							/>
						</div>
					)}
			</div>
		</section>
	);
};
