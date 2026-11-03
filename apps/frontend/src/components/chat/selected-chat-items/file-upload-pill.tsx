import React from "react";
import { CloseIcon } from "../../primitives/icons/close-icon.tsx";
import { LoadingSpinnerIcon } from "../../primitives/icons/loading-spinner-icon.tsx";
import { RedErrorIcon } from "../../primitives/icons/red-error-icon.tsx";
import {
	isPendingUpload,
	UPLOAD_STATUS_MAP,
	type UploadStatusKeys,
} from "../../../store/use-file-uploads-store.ts";
import Content from "../../../content.ts";

interface FileUploadPillProps {
	name: string;
	status: UploadStatusKeys;
	onRemove: (name: string) => void;
}

export const FileUploadPill: React.FC<FileUploadPillProps> = ({
	name,
	status,
	onRemove,
}) => {
	const isPending = isPendingUpload(status);
	const statusLabel = UPLOAD_STATUS_MAP[status];

	const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
		e.stopPropagation();
		onRemove(name);
	};

	const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
		if (event.key !== "Enter" && event.key !== " ") {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		onRemove(name);
	};

	return (
		<div
			data-testid={`file-upload-pill-${name}`}
			title={`${name}: ${statusLabel}`}
			className="flex items-center gap-x-1 rounded-[3px] bg-hellblau-30 px-2 py-1.5 shadow-[0px_0px_3px_0px_rgba(12,39,83,0.20)] text-dunkelblau-100"
		>
			<span aria-hidden="true" className="flex size-5 shrink-0">
				{isPending ? (
					<LoadingSpinnerIcon size="small" />
				) : (
					<RedErrorIcon size="small" />
				)}
			</span>
			<div className="flex gap-x-3">
				<span className="text-sm leading-5 font-normal min-w-0 grow max-w-44 truncate">
					{name}
					<span className="sr-only">: {statusLabel}</span>
				</span>

				<div
					role="button"
					data-testid={`remove-upload-${name}`}
					aria-label={`${name} ${Content["chat.fileUploadPill.remove.ariaLabel"]}`}
					tabIndex={0}
					onClick={handleClick}
					onKeyDown={handleKeyDown}
					className="flex items-center justify-center hover:bg-hellblau-50 rounded-[3px] focus-visible:outline-default"
				>
					<CloseIcon className="size-4" variant="darkBlue" />
				</div>
			</div>
		</div>
	);
};
