import React from "react";
import { useDrawerStore } from "../../../store/drawer-store";
import { BarsIcon } from "../../primitives/icons/bars-icon";
import { useTooltipStore } from "../../../store/tooltip-store";
import Content from "../../../content";
import { SidebarIcon } from "../../primitives/icons/sidebar-icon";
interface HistoryToggleButtonProps {
	isLabelVisible?: boolean;
}

export const HistoryToggleButton: React.FC<HistoryToggleButtonProps> = ({
	isLabelVisible = false,
}) => {
	const { openDrawerId, setOpenDrawer } = useDrawerStore();
	const { showTooltip, hideTooltip } = useTooltipStore();
	const isHistorySidebarOpen = openDrawerId === "history";

	const handleToggle = () => {
		setOpenDrawer(isHistorySidebarOpen ? null : "history");
		hideTooltip();
	};

	const handleInteractionStart = (
		event: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>,
	) => {
		if (isHistorySidebarOpen) {
			return;
		}
		showTooltip({
			event,
			content: Content["sidebar.tooltip.historyToggleButton"],
			isLight: true,
		});
	};
	return (
		<>
			<button
				aria-label={
					isHistorySidebarOpen
						? Content["historyToggleButton.arialabel.close"]
						: Content["historyToggleButton.arialabel.open"]
				}
				className={`flex flex-col items-center justify-center gap-1 size-8 p-1 md:w-auto rounded-[3px] text-hellblau-50 md:hover:bg-dunkelblau-90 focus-visible:outline-default
					${isHistorySidebarOpen && "bg-hellblau-50 md:bg-transparent"}`}
				onClick={handleToggle}
				onMouseEnter={handleInteractionStart}
				onMouseLeave={hideTooltip}
				onFocus={handleInteractionStart}
				onBlur={hideTooltip}
			>
				{isLabelVisible ? (
					<>
						{/* mobile icon */}
						<BarsIcon isLight={!isHistorySidebarOpen} />

						<span
							className={`text-sm leading-5 font-normal ${isHistorySidebarOpen ? "text-dunkelblau-100" : "text-hellblau-50 md:hidden"}`}
						>
							{Content["historyToggleButton.label"]}
						</span>
					</>
				) : (
					//desktop icon
					<SidebarIcon isOpen={isHistorySidebarOpen} />
				)}
			</button>
		</>
	);
};
