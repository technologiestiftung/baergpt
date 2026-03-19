import React, { useEffect, useRef } from "react";
import { useDocumentStore } from "../../../../store/document-store.ts";
import { useDrag } from "react-dnd";
import type { Document } from "../../../../common.ts";
import { DocumentIcon } from "../../../primitives/icons/document-icon.tsx";
import { getListItemName } from "./utils/get-list-item-name.ts";
import { useTooltipStore } from "../../../../store/tooltip-store.ts";
import { getEmptyImage } from "react-dnd-html5-backend";

type DragableProps = {
	item: Document;
};

const TOOLTIP_DELAY = 600;

export function DraggableDocumentName({ item }: DragableProps) {
	const { selectPreviewDocument, selectedPreviewDocument } = useDocumentStore();
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

	const [{ isDragging }, dragRef, preview] = useDrag<
		Document,
		unknown,
		{ isDragging: boolean }
	>({
		type: "ITEM",
		item: () => {
			if (tooltipTimeoutRef.current) {
				clearTimeout(tooltipTimeoutRef.current);
				tooltipTimeoutRef.current = null;
			}
			hideTooltip();
			return item;
		},
		collect: (monitor) => ({ isDragging: monitor.isDragging() }),
	});

	useEffect(() => {
		preview(getEmptyImage(), { captureDraggingState: true });
	}, [preview]);

	const isSelectedForPreview = selectedPreviewDocument?.id === item.id;

	return (
		<button
			draggable="true"
			className="flex w-0 grow rounded-3px focus-visible:outline-default"
			onClick={() => selectPreviewDocument(item)}
			ref={dragRef}
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}
			onMouseDown={handleMouseLeave}
			onFocus={handleMouseEnter}
			onBlur={handleMouseLeave}
		>
			<span className="flex gap-x-1 truncate">
				<DocumentIcon variant="lightBlue" />
				<span
					ref={spanRef}
					className={`truncate pointer-events-none text-sm leading-5 ${isDragging ? "text-hellblau-110" : "text-dunkelblau-100"}
					${isSelectedForPreview ? "font-bold" : "font-normal"}`}
				>
					{getListItemName(item)}
				</span>
			</span>
		</button>
	);
}
