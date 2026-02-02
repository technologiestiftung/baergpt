import React, { useRef } from "react";
import { useDocumentStore } from "../../../../store/document-store.ts";
import { useDrag } from "react-dnd";
import type { Document } from "../../../../common.ts";
import { DocumentIcon } from "../../../primitives/icons/document-icon.tsx";
import { getListItemName } from "./utils/get-list-item-name.ts";
import { useTooltipStore } from "../../../../store/tooltip-store.ts";

type DragableProps = {
	item: Document;
};

const TOOLTIP_DELAY = 600;

/**
 * Renders a draggable document name button that opens a preview on click and shows a delayed tooltip on hover or focus.
 *
 * The button supports drag-and-drop (type "ITEM") and measures the visible text width to position the tooltip correctly.
 *
 * @param item - The document to display and act on when selected or dragged
 * @returns A JSX element: a button showing the document icon and truncated name with drag-and-drop and tooltip behavior
 */
export function DraggableDocumentName({ item }: DragableProps) {
	const { selectPreviewDocument } = useDocumentStore();
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

	const [, dragRef] = useDrag({
		type: "ITEM",
		item,
	});

	return (
		<button
			draggable="true"
			className="flex w-0 grow rounded-3px focus-visible:outline-default"
			onClick={() => selectPreviewDocument(item)}
			ref={dragRef}
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}
			onFocus={handleMouseEnter}
			onBlur={handleMouseLeave}
		>
			<span className="flex gap-x-2 truncate">
				<DocumentIcon variant="lightBlue" />
				<span
					ref={spanRef}
					className="truncate pointer-events-none text-sm leading-5 font-normal"
				>
					{getListItemName(item)}
				</span>
			</span>
		</button>
	);
}