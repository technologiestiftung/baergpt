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
					className={`flex flex-col justify-between h-full pt-5 pb-3.5 transition-opacity duration-300 ease-in-out ${
						isHistorySidebarOpen ? "pl-3 pr-[18px] gap-10" : "px-2.5 items-left"
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
					<div>
						<div className="h-[130px] flex flex-col justify-between">
							{/* Full-width border */}
							{isHistorySidebarOpen && (
								<span className="block w-[calc(100%+30px)] ml-[-12px] h-px bg-dunkelblau-80" />
							)}

							{/* Navigation */}
							<div className={`w-full py-2 ${isHistorySidebarOpen && "px-1"}`}>
								<SidebarNavigation />
							</div>

							{/* Full-width border */}
							{isHistorySidebarOpen && (
								<span className="block w-[calc(100%+30px)] ml-[-12px] h-px bg-dunkelblau-80" />
							)}
						</div>

						{/* CityLAB Logo */}
						<div
							className={`flex flex-col gap-[3px] h-[50px] justify-end pt-3.5 
								${isHistorySidebarOpen ? "px-3" : ""}`}
						>
							{isHistorySidebarOpen && (
								<p className="text-dunkelblau-50 text-[10px] truncate">
									Entwickelt vom
								</p>
							)}

							<a
								href="https://citylab-berlin.org/"
								target="_blank"
								rel="noopener noreferrer"
								className={`focus-visible:outline-default rounded-3px w-fit h-[18px] flex flex-row items-center gap-[6.6px]
									${isHistorySidebarOpen ? "pr-1" : "px-2"}`}
								aria-label="CityLAB Berlin Website"
							>
								<img
									src="/icons/citylab-shapes-icon.svg"
									alt="citylab-icon"
									height="18px"
									className="hidden md:flex shrink-0"
								/>
								{isHistorySidebarOpen && (
									<img
										src="/icons/citylab-berlin.svg"
										alt="citylab-icon"
										height={9.6}
										width={67.5}
										className="hidden md:flex shrink-0"
									/>
								)}
							</a>
						</div>
					</div>
				</aside>
			</div>
		</div>
	);
};
