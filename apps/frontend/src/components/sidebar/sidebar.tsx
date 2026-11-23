import React from "react";
import { DesktopSidebar } from "./desktop-sidebar";
import { MobileSidebar } from "./mobile-sidebar";
import { DeleteHistoryEntriesDialog } from "./history/delete-history-entry/delete-history-entries-dialog";

export const Sidebar: React.FC = () => {
	return (
		<>
			<DesktopSidebar />
			<MobileSidebar />
			<DeleteHistoryEntriesDialog />
		</>
	);
};
