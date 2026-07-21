import React from "react";
import { useTooltipStore } from "../../store/tooltip-store";

export const SidebarButton: React.FC<{
	iconSrc: string;
	label: string;
	ariaLabel: string;
	isLabelVisible: boolean;
	onClick: () => void;
}> = ({ iconSrc, label, ariaLabel, isLabelVisible, onClick }) => {
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
		<button
			type="button"
			className={`relative flex w-full flex-row items-center justify-start gap-2 p-1.5 rounded-[3px] h-10 md:h-8
				text-hellblau-50 md:hover:bg-dunkelblau-90 focus-visible:outline-default`}
			onClick={onClick}
			onMouseEnter={(event) => handleInteractionStart(event, label)}
			onMouseLeave={hideTooltip}
			onFocus={(event) => handleInteractionStart(event, label)}
			onBlur={hideTooltip}
			aria-label={ariaLabel}
		>
			<div className="flex w-5 h-5 flex-shrink-0">
				<img
					src={iconSrc}
					width={20}
					height={20}
					alt={`${label}-icon`}
					className="w-full h-full object-contain"
				/>
			</div>
			{isLabelVisible && (
				<span className="text-sm font-normal whitespace-nowrap">{label}</span>
			)}
		</button>
	);
};
