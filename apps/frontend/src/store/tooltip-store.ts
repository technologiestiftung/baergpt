import { create } from "zustand";
import React from "react";

interface ShowTooltipArgs {
	event: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>;
	content: string;
	width?: number | string;
	isLight?: boolean;
	offset?: { top?: number; right?: number };
}

interface TooltipState {
	visible: boolean;
	rendered: boolean;
	top: number;
	left: number;
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
		content,
		width,
		isLight,
		offset = { top: 0, right: 4 },
	}) => {
		// Clear any existing fade-out timeout
		if (fadeOutTimeout) {
			clearTimeout(fadeOutTimeout);
		}

		const rect = event.currentTarget.getBoundingClientRect();
		const top = rect.top + window.scrollY + (offset.top || 0);
		const left = rect.right + (offset.right || 0);

		set({
			rendered: true,
			visible: true,
			isLight: isLight,
			top,
			left,
			content,
			width,
		});
	},
}));
