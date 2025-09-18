import React from "react";
import { HistoryToggleButton } from "./sidebar-buttons/history-toggle-button.tsx";
import { useDrawerStore } from "../../store/drawer-store.ts";
import { SidebarNavigation } from "./sidebar-navigation.tsx";
import { NewChatButton } from "./sidebar-buttons/new-chat-button.tsx";
import Content from "../../content.ts";
import { History } from "./history/history.tsx";

export const DesktopSidebar: React.FC = () => {
	const { openDrawerId } = useDrawerStore();
	const isHistorySidebarOpen = openDrawerId === "history";

	return (
		<div className="hidden md:flex flex-col h-full">
			<div
				className={`relative bottom-0 left-0 z-30 h-full transition-all duration-300 ease-in-out ${
					isHistorySidebarOpen
						? "w-[280px] min-w-[280px] bg-dunkelblau-100"
						: "w-[70px] min-w-[70px] bg-dunkelblau-100"
				}`}
			>
				<aside
					className={`flex flex-col justify-between h-full pt-6 pb-5 transition-opacity duration-300 ease-in-out ${
						isHistorySidebarOpen ? "px-5 gap-10" : "px-5 gap-3 items-left"
					}`}
					aria-label={Content["sidebar.ariaLabel"]}
				>
					{/* Top Section */}
					<div
						className={`${isHistorySidebarOpen ? "gap-2" : "gap-3"} flex flex-col items-start w-fit`}
					>
						<HistoryToggleButton
							isLabelVisible={isHistorySidebarOpen ? false : undefined}
						/>

						<div className={`${isHistorySidebarOpen && "pt-[1px]"}`}>
							<NewChatButton isExpanded={isHistorySidebarOpen} />
						</div>
					</div>

					{/* History Content */}
					{isHistorySidebarOpen && (
						<div className="flex flex-col gap-10 min-h-0 h-full overflow-y-auto">
							<History />
						</div>
					)}
					<div>
						{/* Full-width border */}
						{isHistorySidebarOpen && (
							<span className="block w-[calc(100%+40px)] ml-[-20px] h-px bg-dunkelblau-80" />
						)}

						{/* Navigation */}
						<div
							className={`w-full pt-4 ${
								isHistorySidebarOpen && "px-0 flex justify-center"
							}`}
						>
							<SidebarNavigation />
						</div>
					</div>
				</aside>
			</div>
		</div>
	);
};
