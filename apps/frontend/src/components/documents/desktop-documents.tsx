import React, { useRef, useState } from "react";
import DocumentBreadcrumbs from "./document-breadcrumbs.tsx";
import { CreateFolderButton } from "./create-folder/create-folder-button.tsx";
import { DeleteItemButton } from "./delete-item/delete-item-button.tsx";
import { DocumentsList } from "./document-list/documents-list.tsx";
import { FileUpload } from "./file-upload/file-upload.tsx";
import { DocumentIcon } from "../primitives/icons/document-icon.tsx";
import { CloseIcon } from "../primitives/icons/close-icon.tsx";
import { Content } from "../../content.ts";
import { Resizer } from "./resizer.tsx";
import { useTooltipStore } from "../../store/tooltip-store.ts";
import { DropZoneWrapperDocuments } from "./document-list/drop-zone-wrapper-documents.tsx";
import { useErrorStore } from "../../store/error-store.ts";
import { useDocumentStore } from "../../store/document-store.ts";
import { useFileUploadsStore } from "../../store/use-file-uploads-store.ts";

const MIN_WIDTH = 350;
const MAX_WIDTH = 700;
const DEFAULT_WIDTH = 400;
const COLLAPSED_WIDTH = 64;

export function DesktopDocuments({ hasItems }: { hasItems: boolean }) {
	const [isCollapsed, setIsCollapsed] = useState(false);
	const [width, setWidth] = useState(DEFAULT_WIDTH);
	const [isResizing, setIsResizing] = useState(false);
	const { showTooltip, hideTooltip } = useTooltipStore();
	const documentButtonRef = useRef<HTMLButtonElement>(null);
	const { getUIError } = useErrorStore();
	const { getDocuments, isLoading, documents, deletedDefaultDocumentIds } = useDocumentStore();
	const { hasAvailableUploadSlots } = useFileUploadsStore();

	const errorMessage = getUIError("documents-fetch");

	const handleResize = (newWidth: number) => {
		setIsResizing(true);
		setWidth(newWidth);
	};

	const handleResizeEnd = () => {
		setIsResizing(false);
	};

	const handleInteractionStart = (
		event: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>,
		tooltipLabel: string,
	) => {
		if (!isCollapsed) {
			return;
		}

		showTooltip({ event, content: tooltipLabel });
	};

	const handleRetry = () => {
		const abortController = new AbortController();
		getDocuments(abortController.signal);
	};

	const numberOfUploads = documents?.filter((doc) => !deletedDefaultDocumentIds.includes(doc.id)).length || 0;
	const hasReachedTotalUploadLimit =
		numberOfUploads >= Number(import.meta.env.VITE_MAX_TOTAL_FILES_UPLOADED);

	const isDropZoneDisabled =
		hasReachedTotalUploadLimit || !hasAvailableUploadSlots();

	return (
		<>
			<DropZoneWrapperDocuments
				className={`hidden md:flex flex-col h-full pt-6 pb-5 bg-hellblau-50 will-change-[width] transition-[width] duration-300 ease-in-out
					${isResizing && "transition-none"} ${isCollapsed ? "px-4 hover:bg-hellblau-60 cursor-pointer" : "px-6"}
				`}
				id="desktop-documents-panel"
				style={{
					width: isCollapsed ? COLLAPSED_WIDTH : `${width}px`,
				}}
				isDropZoneDisabled={isDropZoneDisabled}
				{...(isCollapsed && {
					onClick: () => {
						hideTooltip();
						setIsCollapsed(!isCollapsed);
					},
					onMouseEnter: () => {
						if (documentButtonRef.current) {
							handleInteractionStart(
								{
									target: documentButtonRef.current,
									currentTarget: documentButtonRef.current,
								} as unknown as React.MouseEvent<HTMLElement>,
								Content["documentsSection.mainFolder.label"],
							);
						}
					},
					onMouseLeave: hideTooltip,
					onFocus: () => {
						if (documentButtonRef.current) {
							handleInteractionStart(
								{
									target: documentButtonRef.current,
									currentTarget: documentButtonRef.current,
								} as unknown as React.MouseEvent<HTMLElement>,
								Content["documentsSection.mainFolder.label"],
							);
						}
					},
					onBlur: hideTooltip,
				})}
			>
				<div className="flex w-full justify-between">
					<div className="flex gap-2">
						<button
							ref={documentButtonRef}
							className={`flex w-8 p-1 rounded-3px hover:bg-hellblau-60 focus-visible:outline-default ${!isCollapsed && "-ml-2"}`}
							onClick={() => {
								hideTooltip();
								setIsCollapsed(!isCollapsed);
							}}
							aria-expanded={isCollapsed}
							aria-label={Content["documentsSection.showFiles.ariaLabel"]}
							onMouseEnter={(event) =>
								handleInteractionStart(
									event,
									Content["documentsSection.mainFolder.label"],
								)
							}
							onMouseLeave={hideTooltip}
							onFocus={(event) =>
								handleInteractionStart(
									event,
									Content["documentsSection.mainFolder.label"],
								)
							}
							onBlur={hideTooltip}
						>
							<DocumentIcon variant="black" />
						</button>
						<h2
							className={`text-dunkelblau-200 text-2xl font-bold flex gap-x-2 ${isCollapsed && "hidden"}`}
						>
							{Content["documentsSection.title"]}
						</h2>
					</div>
					<button
						className={`p-1 rounded-3px hover:bg-hellblau-60 focus-visible:outline-default ${isCollapsed && "hidden"}`}
						onClick={() => setIsCollapsed(true)}
						aria-label={Content["documentsSection.hideFiles.ariaLabel"]}
					>
						<CloseIcon />
					</button>
				</div>

				{!isCollapsed && (
					<>
						<div className="mt-11">
							<DocumentBreadcrumbs />
						</div>

						<div className="hidden md:flex gap-4 items-center mt-8 mb-2">
							<CreateFolderButton />
							{hasItems && <DeleteItemButton id={"desktop"} />}
						</div>

						{hasItems && (
							<>
								<div className="flex h-full mt-3 md:mt-0">
									<DocumentsList />
								</div>
								{/* Full-width border */}
								<span className="block mt-8 w-[calc(100%+48px)] ml-[-24px] h-[2px] dunkelblau-40" />
							</>
						)}
						{!hasItems && errorMessage && !isLoading && (
							<div className="flex flex-col gap-3 text-sm leading-5 font-normal text-dunkelblau-100 text-center items-center justify-center h-full w-40 mx-auto">
								<p>{errorMessage}</p>
								<button
									className="flex gap-0.5 underline underline-offset-2 cursor-pointer"
									aria-label={
										Content["documentsSection.fetchRetry.button.ariaLabel"]
									}
									onClick={handleRetry}
								>
									<img
										src="/icons/refresh-blue-icon.svg"
										alt=""
										className="size-6"
									/>
									{Content["documentsSection.fetchRetry.button.label"]}
								</button>
							</div>
						)}

						<div className={`hidden md:flex w-full  ${!hasItems && "h-full"}`}>
							<FileUpload hasItems={hasItems} />
						</div>
					</>
				)}
			</DropZoneWrapperDocuments>
			{!isCollapsed && (
				<Resizer
					currentWidth={width}
					minWidth={MIN_WIDTH}
					maxWidth={MAX_WIDTH}
					onResize={handleResize}
					onResizeEnd={handleResizeEnd}
				/>
			)}
		</>
	);
}
