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
					<div className="p-4 border-t border-dunkelblau-40">
						<SidebarNavigation />
					</div>
				</div>
			</BottomDrawer>
		</>
	);
}
