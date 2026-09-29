import React from "react";
import { useTooltipStore } from "../../store/tooltip-store";
import { useDrawerStore } from "../../store/drawer-store.ts";

export const SidebarLink: React.FC<{
	href: string;
	iconSrc: string;
	label: string;
	ariaLabel: string;
	isLabelVisible: boolean;
}> = ({ href, iconSrc, label, ariaLabel, isLabelVisible }) => {
	const { showTooltip, hideTooltip } = useTooltipStore();
	const { openDrawerId } = useDrawerStore();
	const isHistorySidebarOpen = openDrawerId === "history";

	const handleInteractionStart = (
		event: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>,
		tooltipLabel: string,
	) => {
		if (isLabelVisible) {
			return;
		}

		showTooltip({ event, content: tooltipLabel, isLight: true });
	};
	return (
		<a
			href={href}
			target="_blank"
			rel="noopener noreferrer"
			className={`relative flex w-full flex-row items-center justify-start gap-2 ${isHistorySidebarOpen ? "px-2" : "px-1"} py-1.5 rounded-[3px] h-10 md:h-8 overflow-hidden
				text-hellblau-50 md:hover:bg-dunkelblau-90 focus-visible:outline-default`}
			onMouseEnter={(event) => handleInteractionStart(event, label)}
			onMouseLeave={hideTooltip}
			onFocus={(event) => handleInteractionStart(event, label)}
			onBlur={hideTooltip}
			aria-label={ariaLabel}
		>
			<div className="flex w-6 h-6 flex-shrink-0">
				<img
					src={iconSrc}
					width={20}
					height={20}
					alt={`${label}-icon`}
					className="w-full h-full object-contain"
				/>
			</div>
			{isLabelVisible && (
				<span
					className={`text-sm font-normal whitespace-nowrap ${isHistorySidebarOpen ? "opacity-100 animate-fade-in" : " opacity-0 animate-fade-out"}`}
				>
					{label}
				</span>
			)}
		</a>
	);
};
