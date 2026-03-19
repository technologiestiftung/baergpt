import * as React from "react";
import { useTooltipCitationStore } from "../../../../store/tooltip-citation-store.ts";
import type { CitationWithDetails } from "../../../../common.ts";
import { useInferenceLoadingStatusStore } from "../../../../store/use-inference-loading-status-store.ts";

interface InlineCitationProps {
	citation?: CitationWithDetails | null;
	citationNumber: number;
}

export const InlineCitation: React.FC<InlineCitationProps> = ({
	citation,
	citationNumber,
}) => {
	const { showTooltipCitation, scheduleHide, clearHideTimeout } =
		useTooltipCitationStore();
	const { status } = useInferenceLoadingStatusStore();

	/**
	 * If we're no longer waiting for an inference to finish,
	 * and a citation does not exist, we do not render anything.
	 *
	 * A citation can be missing e.g. when:
	 *
	 * - The LLM hallucinates a citation that does not
	 *   exist in the citations array, or
	 * - An inference has been cancelled or failed
	 *   before the citations have been sent.
	 */
	if (status === "idle" && !citation) {
		return null;
	}

	const handleShowTooltip = (
		event:
			| React.MouseEvent<HTMLButtonElement>
			| React.FocusEvent<HTMLButtonElement>,
	) => {
		clearHideTimeout();

		showTooltipCitation({
			event,
			citation,
			offset: { top: 25 },
		});
	};

	const handleMouseLeave = () => {
		scheduleHide();
	};

	return (
		<button
			className={`
				inline-flex items-center justify-center rounded-sm text-xs 
				cursor-pointer size-[18px] 
				bg-hellblau-50 focus-visible:outline-default
				${citation ? "hover:bg-dunkelblau-100 text-dunkelblau-80 hover:text-white" : "text-hellblau-110 hover:bg-hellblau-50"}`}
			onMouseEnter={handleShowTooltip}
			onMouseLeave={handleMouseLeave}
			onFocus={handleShowTooltip}
			onBlur={handleMouseLeave}
			aria-label={`${citationNumber}: ${citation?.fileName}`}
			tabIndex={0}
		>
			{citationNumber}
		</button>
	);
};
