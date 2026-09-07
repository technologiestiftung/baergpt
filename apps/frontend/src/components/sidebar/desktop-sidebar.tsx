import React from "react";
import { HistoryToggleButton } from "./sidebar-buttons/history-toggle-button.tsx";
import { useDrawerStore } from "../../store/drawer-store.ts";
import { SidebarNavigation } from "./sidebar-navigation.tsx";
import { NewChatButton } from "./sidebar-buttons/new-chat-button.tsx";
import Content from "../../content.ts";
import { History } from "./history/history.tsx";
import { ChatSearchButton } from "./sidebar-buttons/chat-search-button.tsx";
import { DesktopProfileButton } from "../profile/profile-buttons/desktop-profile-button.tsx";

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
					className={`flex flex-col justify-between h-full px-2.5 pt-5 pb-2`}
					aria-label={Content["sidebar.ariaLabel"]}
				>
					{/* Top Section */}
					<div className="flex flex-col gap-6 items-start w-full mb-5">
						<div className="flex justify-between items-center w-full">
							{isHistorySidebarOpen && (
								<a href={"/"}>
									<img
										className="h-7"
										src="/logos/baergpt-logo-white.svg"
										alt={Content["header.logo.alt"]}
									/>
								</a>
							)}
							<HistoryToggleButton
								isLabelVisible={isHistorySidebarOpen ? false : undefined}
							/>
						</div>

						<div className={`h-16 w-full`}>
							<NewChatButton isExpanded={isHistorySidebarOpen} />
							<ChatSearchButton isExpanded={isHistorySidebarOpen} />
						</div>
					</div>

					{/* History Content */}
					{isHistorySidebarOpen && (
						<div className="flex flex-col gap-10 min-h-0 h-full overflow-y-auto overflow-x-hidden">
							<History />
						</div>
					)}
					<div>
						<div className="flex flex-col">
							{/* Full-width border */}
							<span
								className={`block w-[calc(100%+14px)] ml-[-10px] h-[1px] ${isHistorySidebarOpen ? "bg-dunkelblau-90" : "bg-dunkelblau-100"}`}
							/>

							{/* Navigation */}
							<div className="w-full py-2">
								<SidebarNavigation />
							</div>
							{/* Full-width border */}
							<span
								className={`block w-[calc(100%+14px)] ml-[-10px] h-[1px] ${isHistorySidebarOpen ? "bg-dunkelblau-90" : "bg-dunkelblau-100"}`}
							/>
							{/* Profile button */}
							<div className="w-full py-2">
								<DesktopProfileButton />
							</div>
							{/* Full-width border */}
							<span
								className={`block w-[calc(100%+14px)] ml-[-10px] h-[1px] ${isHistorySidebarOpen ? "bg-dunkelblau-90" : "bg-dunkelblau-100"}`}
							/>
						</div>

						{/* CityLAB Logo */}
						<div
							className={`flex w-full justify-between items-center gap-1.5 h-10 pt-2
                                ${isHistorySidebarOpen ? "px-3" : ""}`}
						>
							{isHistorySidebarOpen && (
								<p className="text-dunkelblau-50 text-sm leading-[14px] truncate">
									{Content["sidebar.citylab.label"]}
								</p>
							)}

							<a
								href={Content["sidebar.citylab.link"]}
								target="_blank"
								rel="noopener noreferrer"
								className={`focus-visible:outline-default rounded-3px w-fit h-6 flex flex-row items-center gap-1.5
                                    ${isHistorySidebarOpen ? "pr-1" : "px-2"}`}
								aria-label={Content["sidebar.citylab.ariaLabel"]}
							>
								{isHistorySidebarOpen ? (
									<img
										src="/logos/citylab-berlin-logo-light.svg"
										alt="citylab-icon"
										width="54px"
										className="hidden md:flex shrink-0 mb-[2px]"
									/>
								) : (
									<img
										src="/icons/citylab-shape-icon.svg"
										alt="citylab-icon"
										width="16px"
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
