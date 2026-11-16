import { create } from "zustand";
import React from "react";

interface ShowTooltipArgs {
	event?: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>;
	target?: HTMLElement;
	content: string;
	width?: number | string;
	isLight?: boolean;
	offset?: { top?: number; right?: number };
	anchor?: "right" | "bottom-end";
}

interface TooltipState {
	visible: boolean;
	rendered: boolean;
	top: number;
	left?: number;
	right?: number;
	content: string;
	width?: number | string;
	isLight?: boolean;
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

		if (anchor === "bottom-end") {
			const { top: offsetTop = 4, right: offsetRight = 0 } = offset ?? {};
			const top = rect.bottom + window.scrollY + offsetTop;
			const right =
				document.documentElement.clientWidth - rect.right - offsetRight;

			set({
				rendered: true,
				visible: true,
				isLight,
				top,
				left: undefined,
				right,
				content,
				width,
			});
			return;
		}

		const { top: offsetTop = 0, right: offsetRight = 4 } = offset ?? {};
		const top = rect.top + window.scrollY + offsetTop;
		const left = rect.right + offsetRight;

		set({
			rendered: true,
			visible: true,
			isLight,
			top,
			left,
			right: undefined,
			content,
			width,
		});
	},
}));
