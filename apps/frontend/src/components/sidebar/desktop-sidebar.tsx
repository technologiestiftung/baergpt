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
						? "w-[260px] min-w-[260px] bg-dunkelblau-100"
						: "w-[52px] min-w-[52px] bg-dunkelblau-100"
				}`}
			>
				<aside
					className={`flex flex-col justify-between h-full pt-6 pb-3.5 transition-opacity duration-300 ease-in-out ${
						isHistorySidebarOpen ? "pl-3 pr-1 gap-10" : "px-2.5 items-left"
					}`}
					aria-label={Content["sidebar.ariaLabel"]}
				>
					{/* Top Section */}
					<div className={`gap-3 flex flex-col items-start w-fit`}>
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
					<div className={`${isHistorySidebarOpen && "px-2"}`}>
						{/* Full-width border */}
						{isHistorySidebarOpen && (
							<span className="block w-[calc(100%+20px)] ml-[-16px] h-px bg-dunkelblau-80" />
						)}

						{/* Navigation */}
						<div
							className={`w-full py-2 ${
								isHistorySidebarOpen && "pr-7 flex justify-center"
							}`}
						>
							<SidebarNavigation />
						</div>

						{/* Full-width border */}
						{isHistorySidebarOpen && (
							<span className="block w-[calc(100%+20px)] ml-[-16px] h-px bg-dunkelblau-80" />
						)}

						{/* CityLAB Logo */}
						<div className="pt-3.5 flex flex-col gap-[3px]">
							<p
								className={`${isHistorySidebarOpen ? "block" : "invisible"} text-dunkelblau-50 text-[10px]`}
							>
								Entwickelt vom
							</p>

							<a
								href="https://citylab-berlin.org/"
								target="_blank"
								rel="noopener noreferrer"
								className={`focus-visible:outline-default rounded-3px w-fit 
									${isHistorySidebarOpen ? "pr-1" : "px-2"}`}
								aria-label="CityLAB Berlin Website"
							>
								<img
									src={
										isHistorySidebarOpen
											? "/icons/citylab-full-icon.svg"
											: "/icons/citylab-shapes-icon.svg"
									}
									alt="citylab-icon"
									height="18px"
									className="hidden md:flex shrink-0"
								/>
							</a>
						</div>
					</div>
				</aside>
			</div>
		</div>
	);
};
