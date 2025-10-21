import React from "react";
import { useTooltipStore } from "../../store/tooltip-store";

export const SidebarLink: React.FC<{
	href: string;
	iconSrc: string;
	label: string;
	ariaLabel: string;
	isLabelVisible: boolean;
}> = ({ href, iconSrc, label, ariaLabel, isLabelVisible }) => {
	const { showTooltip, hideTooltip } = useTooltipStore();

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
			className={`relative flex flex-row w-full items-center justify-center md:justify-start gap-0 md:gap-2 p-1.5 rounded-[3px] 
				text-hellblau-50 md:hover:bg-dunkelblau-90 focus-visible:outline-default`}
			onMouseEnter={(event) => handleInteractionStart(event, label)}
			onMouseLeave={hideTooltip}
			onFocus={(event) => handleInteractionStart(event, label)}
			onBlur={hideTooltip}
			aria-label={ariaLabel}
		>
			<img
				src={iconSrc}
				width={20}
				height={20}
				alt={`${label}-icon`}
				className="hidden md:flex shrink-0"
			/>
			{isLabelVisible && (
				<span className="text-sm font-normal whitespace-nowrap">{label}</span>
			)}
		</a>
	);
};
