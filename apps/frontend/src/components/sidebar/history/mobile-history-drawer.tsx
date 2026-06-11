import { History } from "./history.tsx";
import { useDrawerStore } from "../../../store/drawer-store.ts";
import { SidebarNavigation } from "../sidebar-navigation.tsx";
import { BottomDrawer } from "../../primitives/bottom-drawer/bottom-drawer.tsx";
import Content from "../../../content.ts";

export function MobileHistoryDrawer() {
	const { openDrawerId, setOpenDrawer } = useDrawerStore();
	const isHistorySidebarOpen = openDrawerId === "history";
	const handleToggle = () => {
		setOpenDrawer(isHistorySidebarOpen ? null : "history");
	};

	return (
		<>
			<BottomDrawer
				isOpen={isHistorySidebarOpen}
				onClose={handleToggle}
				title={Content["historyToggleButton.label"]}
				classNames="md:hidden"
				style="dark"
			>
				<div className="flex flex-col justify-between h-full min-h-0 mt-[60px]">
					<History />

					<div>
						<div className="px-4 border-y border-dunkelblau-80">
							<SidebarNavigation />
						</div>
						<div
							className={`flex flex-col gap-1.5 md:h-[50px] justify-end py-4 md:pb-0 md:pt-3.5 px-6`}
						>
							<p className="text-dunkelblau-50 text-[10px] truncate">
								{Content["sidebar.citylab.label"]}
							</p>

							<a
								href={Content["sidebar.citylab.link"]}
								target="_blank"
								rel="noopener noreferrer"
								className={`focus-visible:outline-default rounded-3px w-fit h-[18px] flex flex-row items-center gap-[6.6px]`}
								aria-label={Content["sidebar.citylab.ariaLabel"]}
							>
								<img
									src="/icons/citylab-shape-icon.svg"
									alt="citylab-icon"
									width="16px"
									className="flex shrink-0"
								/>
								<img
									src="/icons/citylab-berlin.svg"
									alt="citylab-icon"
									width="38px"
									className="flex shrink-0"
								/>
							</a>
						</div>
					</div>
				</div>
			</BottomDrawer>
		</>
	);
}
