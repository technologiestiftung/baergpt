import { create } from "zustand";
import React from "react";
import type { CitationWithDetails } from "../common.ts";
import { useTooltipStore } from "./tooltip-store.ts";
import Content from "../content.ts";

interface ShowTooltipCitationArgs {
	event: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>;
	citation?: CitationWithDetails | null;
	offset: { top: number };
}

const TOOLTIP_HIDING_DELAY = 175; // milliseconds

interface TooltipCitationState {
	isCitationTooltipVisible: boolean;
	top: number;
	left: number;
	citation: CitationWithDetails | null | undefined;
	hideTimeout: number | undefined;
	showTooltipCitation: (args: ShowTooltipCitationArgs) => void;
	hideTooltipCitation: () => void;
	clearHideTimeout: () => void;
	scheduleHide: () => void;
	tooltipWidth: number;
}

export const useTooltipCitationStore = create<TooltipCitationState>(
	(set, get) => ({
		isCitationTooltipVisible: false,
		top: 0,
		left: 0,
		citation: undefined,
		hideTimeout: undefined,
		tooltipWidth: 360,

		hideTooltipCitation: () => {
			const { hideTimeout } = get();
			if (hideTimeout) {
				clearTimeout(hideTimeout);
			}
			set({ isCitationTooltipVisible: false, hideTimeout: undefined });
		},

		clearHideTimeout: () => {
			const { hideTimeout } = get();
			if (hideTimeout) {
				clearTimeout(hideTimeout);
				set({ hideTimeout: undefined });
			}
		},

		scheduleHide: () => {
			const { citation } = get();

			if (!citation) {
				useTooltipStore.getState().hideTooltip();
				return;
			}

			const { clearHideTimeout } = get();

			clearHideTimeout();

			const timeout = window.setTimeout(() => {
				set({ isCitationTooltipVisible: false, hideTimeout: undefined });
			}, TOOLTIP_HIDING_DELAY);
			set({ hideTimeout: timeout });
		},

		showTooltipCitation: ({ event, offset, citation }) => {
			const { clearHideTimeout } = get();
			clearHideTimeout();

			if (!citation) {
				useTooltipStore.getState().showTooltip({
					event,
					content: Content["chat.citationsButton.loadingLabel"],
					width: 235,
					isLight: true,
					offset: { top: 22, right: -18 },
				});
				return;
			}

			/**
			 * When you hover a citation number before the corresponding citation
			 * has been loaded, you'll see the global tooltip indicating the citations
			 * are still loading. However, if the global tooltip is still visible
			 * after the citations are finished loading, we need to hide the global
			 * tooltip to avoid overlapping tooltips.
			 */
			if (useTooltipStore.getState().visible) {
				useTooltipStore.getState().hideTooltip();
			}

			const rect = event.currentTarget.getBoundingClientRect();
			const top = rect.top + window.scrollY + offset.top;

			/*
			// if the tooltip goes beyond the right edge of the viewport,
			// adjust its position so the right edge aligns with the viewport's right edge
			*/
			const rightEdge = rect.left + get().tooltipWidth;
			const isTooCloseToRightEdge = rightEdge > window.innerWidth;

			const isMobile = window.innerWidth < 640;
			const leftDesktopPosition = isTooCloseToRightEdge
				? Math.max(0, rect.right - get().tooltipWidth)
				: rect.left;

			const left = isMobile ? 20 : leftDesktopPosition;

			set({
				isCitationTooltipVisible: true,
				top,
				left,
				citation,
			});
		},
	}),
);
