import React from "react";
import { useDragLayer } from "react-dnd";
import type { Document } from "../../../common.ts";
import { DocumentIcon } from "../../primitives/icons/document-icon.tsx";
import { getListItemName } from "./list-item/utils/get-list-item-name.ts";

const ROW_THRESHOLD = 5;

type DragLayerState = {
	isDragging: boolean;
	items: Document[] | null;
	currentOffset: { x: number; y: number } | null;
};

export const DocumentDragPreview: React.FC = () => {
	const { isDragging, items, currentOffset } = useDragLayer(
		(monitor): DragLayerState => ({
			isDragging: monitor.isDragging(),
			items: (monitor.getItem() as Document[]) ?? null,
			currentOffset: monitor.getClientOffset(),
		}),
	);

	if (!isDragging || !items || items.length === 0 || !currentOffset) {
		return null;
	}

	const firstItem = items[0];
	const extraCount = items.length - 1;
	const showStackedPreview = items.length <= ROW_THRESHOLD;

	return (
		<div className="pointer-events-none fixed inset-0 z-50">
			<div
				className="inline-flex cursor-grab max-w-52 overflow-hidden rounded-3px bg-hellblau-30 px-3.5 py-2 shadow-md shadow-dunkelblau-100/10"
				style={{
					transform: `translate(${currentOffset.x}px, ${currentOffset.y}px)`,
				}}
			>
				{showStackedPreview ? (
					<span className="flex flex-col gap-y-1 min-w-0">
						{items.map((item) => (
							<span className="flex gap-x-1 min-w-0 items-center">
								<DocumentIcon variant="lightBlue" className="shrink-0" />
								<span className="truncate text-sm leading-5 font-normal text-dunkelblau-100">
									{getListItemName(item)}
								</span>
							</span>
						))}
					</span>
				) : (
					<span className="flex gap-x-1 min-w-0 items-center">
						<DocumentIcon variant="lightBlue" className="shrink-0" />
						<span className="truncate text-sm leading-5 font-normal text-dunkelblau-100">
							{getListItemName(firstItem)}
						</span>
						{extraCount > 0 && (
							<span className="shrink-0 ml-1 rounded-full bg-dunkelblau-100 text-white text-xs font-semibold px-1.5 py-0.5 leading-none">
								+{extraCount}
							</span>
						)}
					</span>
				)}
			</div>
		</div>
	);
};
