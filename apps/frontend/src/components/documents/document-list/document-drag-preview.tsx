import React from "react";
import { useDragLayer } from "react-dnd";
import type { Document } from "../../../common.ts";
import { DocumentIcon } from "../../primitives/icons/document-icon.tsx";
import { getListItemName } from "./list-item/utils/get-list-item-name.ts";

type DragLayerState = {
	isDragging: boolean;
	item: Document | null;
	currentOffset: { x: number; y: number } | null;
};

export const DocumentDragPreview: React.FC = () => {
	const { isDragging, item, currentOffset } = useDragLayer(
		(monitor): DragLayerState => ({
			isDragging: monitor.isDragging(),
			item: (monitor.getItem() as Document) ?? null,
			currentOffset: monitor.getSourceClientOffset(),
		}),
	);

	if (!isDragging || !item || !currentOffset) {
		return null;
	}

	return (
		<div className="pointer-events-none fixed inset-0 z-50">
			<div
				className="inline-flex max-w-52 overflow-hidden rounded-3px bg-hellblau-30 px-3.5 py-2 shadow-md shadow-dunkelblau-100/10"
				style={{
					transform: `translate(${currentOffset.x}px, ${currentOffset.y}px)`,
				}}
			>
				<span className="flex gap-x-1 min-w-0">
					<DocumentIcon variant="lightBlue" className="shrink-0" />
					<span className="truncate text-sm leading-5 font-normal text-dunkelblau-100">
						{getListItemName(item)}
					</span>
				</span>
			</div>
		</div>
	);
};
