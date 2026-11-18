import { create } from "zustand";
import React from "react";

interface ShowTooltipCommonArgs {
	content: string;
	width?: number | string;
	isLight?: boolean;
	offset?: { top?: number; right?: number };
	anchor?: "right" | "bottom-end";
}

type ShowTooltipArgs = ShowTooltipCommonArgs &
	(
		| {
				event: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>;
				target?: never;
		  }
		| { event?: never; target: HTMLElement }
	);

interface TooltipState {
	visible: boolean;
	rendered: boolean;
	top: number;
	left?: number;
	right?: number;
	content: string;
	width?: number | string;
	isLight?: boolean;
	target: HTMLElement | null;
	showTooltip: (args: ShowTooltipArgs) => void;
	hideTooltip: () => void;
}

let fadeOutTimeout: ReturnType<typeof setTimeout> | null = null;

export const useTooltipStore = create<TooltipState>((set) => ({
	visible: false,
	rendered: false,
	top: 0,
	left: 0,
	right: undefined,
	content: "",
	width: undefined,
	isLight: false,
	target: null,

	hideTooltip: () => {
		// Clear any existing fade-out timeout to prevent premature removal
		if (fadeOutTimeout) {
			clearTimeout(fadeOutTimeout);
		}

		set({ visible: false });
		// Delay removal from DOM to allow fade-out animation
		fadeOutTimeout = setTimeout(() => set({ rendered: false }), 200); // Match fade-out animation duration
	},

	showTooltip: ({
		event,
		target,
		content,
		width,
		isLight,
		offset,
		anchor = "right",
	}) => {
		// Clear any existing fade-out timeout
		if (fadeOutTimeout) {
			clearTimeout(fadeOutTimeout);
		}

		const element = target ?? event?.currentTarget;
		if (!element) {
			return;
		}
		const rect = element.getBoundingClientRect();

		const isBottomEnd = anchor === "bottom-end";
		const defaultOffset = isBottomEnd
			? { top: 4, right: 0 }
			: { top: 0, right: 4 };
		const offsetTop = offset ? (offset.top ?? 0) : defaultOffset.top;
		const offsetRight = offset ? (offset.right ?? 0) : defaultOffset.right;
		const top = isBottomEnd
			? rect.bottom + window.scrollY + offsetTop
			: rect.top + window.scrollY + offsetTop;
		const left = isBottomEnd ? undefined : rect.right + offsetRight;
		const right = isBottomEnd
			? document.documentElement.clientWidth - rect.right - offsetRight
			: undefined;

		set({
			rendered: true,
			visible: true,
			isLight,
			top,
			left,
			right,
			content,
			width,
			target: element,
		});
	},
}));
