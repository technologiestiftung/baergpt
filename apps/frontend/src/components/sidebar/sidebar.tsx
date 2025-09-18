import React from "react";
import { DesktopSidebar } from "./desktop-sidebar";
import { MobileSidebar } from "./mobile-sidebar";
import { DeleteHistoryEntryDialog } from "./history/delete-history-entry/delete-history-entry-dialog";

export const Sidebar: React.FC = () => {
	return (
		<>
			<DesktopSidebar />
			<MobileSidebar />
			<DeleteHistoryEntryDialog />
		</>
	);
};
