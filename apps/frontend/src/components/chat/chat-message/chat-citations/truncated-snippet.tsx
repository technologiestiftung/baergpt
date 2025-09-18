import React, { useRef, useState, useLayoutEffect } from "react";

const lineClampStyle: { [key: number]: string } = {
	2: "line-clamp-2",
	3: "line-clamp-3",
};

interface TruncatedSnippetProps {
	text: string;
	lines: number;
}

export const TruncatedSnippet: React.FC<TruncatedSnippetProps> = ({
	text,
	lines,
}) => {
	const invisibleMeasurementSpanRef = useRef<HTMLSpanElement>(null); // hidden element used for measuring
	const [displayText, setDisplayText] = useState(text);

	const updateTextTruncation = () => {
		if (!invisibleMeasurementSpanRef.current) {
			return;
		}

		const invisibleMeasurementSpanElement = invisibleMeasurementSpanRef.current;
		// calculate maxHeight based on actual line height
		const lineHeight = parseFloat(
			getComputedStyle(invisibleMeasurementSpanElement).lineHeight || "0",
		);
		const maxHeight = lines * lineHeight;

		// Check if full text fits
		invisibleMeasurementSpanElement.textContent = `${text}“`;
		if (invisibleMeasurementSpanElement.scrollHeight <= maxHeight) {
			setDisplayText(`${text}“`);
			return;
		}

		// binary search longest substring that fits
		const suffix = "…“";
		let start = 0;
		let end = text.length;
		let mostFittingEnd = 0;

		while (start <= end) {
			const mid = Math.floor((start + end) / 2);
			invisibleMeasurementSpanElement.textContent = text.slice(0, mid) + suffix;

			if (invisibleMeasurementSpanElement.scrollHeight <= maxHeight) {
				mostFittingEnd = mid;
				start = mid + 1;
			} else {
				end = mid - 1;
			}
		}

		setDisplayText(text.slice(0, mostFittingEnd) + suffix);
	};

	useLayoutEffect(() => {
		updateTextTruncation();
		const invisibleMeasurementSpanElement = invisibleMeasurementSpanRef.current;

		if (!invisibleMeasurementSpanElement) {
			return () => {};
		}

		const observer = new ResizeObserver(updateTextTruncation); // recalc on resize
		observer.observe(invisibleMeasurementSpanElement);

		return () => {
			observer.disconnect();
		};
	}, [text, lines]);

	return (
		<>
			{/* actual visible text with proper opening quote */}
			<p
				className={`whitespace-normal text-start ${lineClampStyle[lines]}`}
			>{`„${displayText}`}</p>

			{/* hidden measurement span */}
			<span
				ref={invisibleMeasurementSpanRef}
				className="absolute invisible whitespace-normal w-full"
			/>
		</>
	);
};
