import React from "react";
import { DesktopSidebar } from "./desktop-sidebar";
import { MobileSidebar } from "./mobile-sidebar";
import { DeleteHistoryEntryDialog } from "./history/delete-history-entry/delete-history-entry-dialog";
import { DeleteSelectedHistoryEntriesDialog } from "./history/delete-history-entry/delete-selected-history-entries-dialog";

export const Sidebar: React.FC = () => {
	return (
		<>
			<DesktopSidebar />
			<MobileSidebar />
			<DeleteHistoryEntryDialog />
			<DeleteSelectedHistoryEntriesDialog />
		</>
	);
};
