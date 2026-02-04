import React, { useRef } from "react";
import { FolderIcon } from "../../../primitives/icons/folder-icon.tsx";
import { getListItemName } from "./utils/get-list-item-name.ts";
import { getDragAndDropId } from "./utils/get-drag-and-drop-id.ts";
import type { DocumentFolder } from "../../../../common.ts";
import { useFolderStore } from "../../../../store/folder-store.ts";
import { useDragAndDropStore } from "../../../../store/drag-and-drop-store.ts";
import { useTooltipStore } from "../../../../store/tooltip-store.ts";

type DroppableFolderNameProps = {
	item: DocumentFolder;
};

const TOOLTIP_DELAY = 600;

export function DroppableFolderName({ item }: DroppableFolderNameProps) {
	const { setCurrentFolder } = useFolderStore();
	const { hoveredFolderId } = useDragAndDropStore();

	const isHoveredForDrop = getDragAndDropId(item) === hoveredFolderId;

	const { showTooltip, hideTooltip } = useTooltipStore();
	const tooltipTimeoutRef = useRef<number | null>(null);
	const spanRef = useRef<HTMLSpanElement>(null);

	const handleMouseEnter = (
		event: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>,
	) => {
		const target = event.currentTarget;
		const syntheticEvent = { ...event, currentTarget: target };

		const span = spanRef.current;

		const truncatedTextWidth = span?.offsetWidth ?? 0;

		tooltipTimeoutRef.current = window.setTimeout(() => {
			showTooltip({
				event: syntheticEvent,
				content: getListItemName(item),
				offset: { top: -30, right: -(truncatedTextWidth - 20) },
			});
		}, TOOLTIP_DELAY);
	};

	const handleMouseLeave = () => {
		if (tooltipTimeoutRef.current) {
			clearTimeout(tooltipTimeoutRef.current);
			tooltipTimeoutRef.current = null;
		}
		hideTooltip();
	};

	return (
		<button
			className={`flex w-0 grow gap-x-2 py-1 rounded-3px focus-visible:outline-default ${isHoveredForDrop && "bg-hellblau-100 outline-default outline-dunkelblau-100"}`}
			onClick={() => {
				setCurrentFolder(item);
				handleMouseLeave();
			}}
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}
			onFocus={handleMouseEnter}
			onBlur={handleMouseLeave}
		>
			<FolderIcon />
			<span
				ref={spanRef}
				className="truncate pointer-events-none text-sm leading-5 font-normal"
			>
				{getListItemName(item)}
			</span>
		</button>
	);
}
