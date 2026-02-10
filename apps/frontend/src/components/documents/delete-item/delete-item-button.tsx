import React from "react";
import { showDeleteDialog } from "./delete-item-dialog";
import { useDocumentStore } from "../../../store/document-store";
import { useFolderStore } from "../../../store/folder-store";
import { BucketIcon } from "../../primitives/icons/bucket-icon.tsx";
import { useTooltipStore } from "../../../store/tooltip-store";
import Content from "../../../content";

export const DeleteItemButton: React.FC = () => {
	const { selectedDocumentsForAction } = useDocumentStore();
	const { selectedFoldersForAction } = useFolderStore();
	const { showTooltip, hideTooltip } = useTooltipStore();

	const itemsToDelete = [
		...selectedDocumentsForAction,
		...selectedFoldersForAction,
	];

	const handleShowTooltip = (
		event: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>,
	) => {
		showTooltip({
			event,
			content: Content["deleteItemButton.tooltip"],
			offset: { top: 34, right: -42 },
		});
	};
	return (
		<>
			{itemsToDelete.length > 0 && (
				<button
					className={`flex rounded-3px w-fit items-center p-[7px]
				hover:bg-hellblau-100 disabled:text-dunkelblau-40 disabled:hover:bg-hellblau-60
				focus-visible:outline-default text-dunkelblau-100`}
					aria-label={Content["deleteItemButton.ariaLabel"]}
					onClick={() => {
						showDeleteDialog();
						hideTooltip();
					}}
					onMouseEnter={handleShowTooltip}
					onMouseLeave={hideTooltip}
					onFocus={handleShowTooltip}
					onBlur={hideTooltip}
				>
					<BucketIcon className="size-[18px]" />
				</button>
			)}
		</>
	);
};
