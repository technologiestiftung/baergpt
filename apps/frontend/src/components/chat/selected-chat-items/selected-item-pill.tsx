import React from "react";
import { FolderIcon } from "../../primitives/icons/folder-icon.tsx";
import { DocumentIcon } from "../../primitives/icons/document-icon.tsx";
import { CloseIcon } from "../../primitives/icons/close-icon.tsx";

interface SelectedItemProps {
	id: number;
	name: string;
	isFolder: boolean;
	onRemove: (id: number) => void;
}

export const SelectedItemPill: React.FC<SelectedItemProps> = ({
	id,
	name,
	isFolder,
	onRemove,
}) => {
	const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
		e.stopPropagation();
		onRemove(id);
	};

	const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
		if (event.key !== "Enter") {
			return;
		}
		onRemove(id);
	};

	return (
		<div className="flex items-center gap-x-1 rounded-[3px] bg-hellblau-30 px-2 py-1.5 shadow-[0px_0px_3px_0px_rgba(12,39,83,0.20)] text-dunkelblau-100">
			{isFolder ? (
				<FolderIcon className="size-5" variant="darkblue" />
			) : (
				<DocumentIcon className="size-5" variant="darkBlue" />
			)}
			<div className="flex gap-x-3">
				<span className="text-sm leading-5 font-normal min-w-0 grow max-w-44 truncate">
					{name}
				</span>

				<div
					role="button"
					data-testid={`remove-item-${name}`}
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
