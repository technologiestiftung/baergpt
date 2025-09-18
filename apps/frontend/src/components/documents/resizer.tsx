import React, { useCallback, useEffect, useRef, useState } from "react";

type ResizerProps = {
	currentWidth: number;
	minWidth: number;
	maxWidth: number;
	onResize: (newWidth: number) => void;
	onResizeEnd?: () => void;
};

export function Resizer({
	currentWidth,
	minWidth,
	maxWidth,
	onResize,
	onResizeEnd,
}: ResizerProps) {
	const [isDragActive, setIsDragActive] = useState(false);
	const isDragging = useRef(false);
	const startX = useRef(0);
	const startWidth = useRef(currentWidth);

	const handleMouseMove = useCallback(
		(e: MouseEvent) => {
			if (!isDragging.current) {
				return;
			}
			const newWidth = Math.max(
				minWidth,
				Math.min(startWidth.current + (e.clientX - startX.current), maxWidth),
			);
			onResize(newWidth);
		},
		[minWidth, maxWidth, onResize],
	);

	const handleMouseUp = useCallback(() => {
		if (isDragging.current) {
			isDragging.current = false;
			setIsDragActive(false);
			document.body.style.cursor = "default";
			onResizeEnd?.();
		}
	}, [onResizeEnd]);

	useEffect(() => {
		window.addEventListener("mousemove", handleMouseMove);
		window.addEventListener("mouseup", handleMouseUp);
		return () => {
			window.removeEventListener("mousemove", handleMouseMove);
			window.removeEventListener("mouseup", handleMouseUp);
		};
	}, [handleMouseMove, handleMouseUp]);

	const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
		isDragging.current = true;
		setIsDragActive(true);
		startX.current = e.clientX;
		startWidth.current = currentWidth;
		document.body.style.cursor = "ew-resize";
	};

	return (
		<div
			id="desktop-document-panel-resizer"
			onMouseDown={handleMouseDown}
			data-is-resizing={isDragActive}
			className={`w-1 h-full cursor-ew-resize transition-colors ${
				isDragActive
					? "bg-hellblau-100"
					: "bg-transparent hover:bg-hellblau-100"
			}`}
		/>
	);
}
