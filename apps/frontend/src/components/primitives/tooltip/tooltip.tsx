import React from "react";
import { useTooltipStore } from "../../../store/tooltip-store";

export const Tooltip: React.FC = () => {
	const { rendered, visible, top, left, content, width, isLight } =
		useTooltipStore();

	if (!rendered) {
		return null;
	}

	return (
		<div
			className={`absolute z-50 w-fit p-[5px] rounded-[3px] text-sm leading-5 font-normal text-white ${visible ? "animate-fade-in" : "animate-fade-out-tooltip pointer-events-none"} ${isLight ? "bg-dunkelblau-90" : "bg-dunkelblau-100"}`}
			style={{ top, left, width }}
			dangerouslySetInnerHTML={{ __html: content }}
			role="tooltip"
			data-testid="tooltip"
		/>
	);
};
