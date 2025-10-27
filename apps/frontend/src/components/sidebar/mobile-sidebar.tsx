import React from "react";
import { HistoryToggleButton } from "./sidebar-buttons/history-toggle-button";
import { DocumentsToggleButton } from "./sidebar-buttons/documents-toggle-button";
import { NewChatMobileButton } from "./sidebar-buttons/new-chat-mobile-button";
import { AppNavItems } from "../headers/app/app-nav-items.tsx";
import Content from "../../content";

export const MobileSidebar: React.FC = () => {
	return (
		<div className="absolute bottom-0 left-0 z-50 w-full md:hidden">
			<aside
				className="flex flex-col z-30 justify-between gap-10 bg-dunkelblau-100 border-t border-dunkelblau-80"
				aria-label={Content["bottomMenuBar.arialabel"]}
			>
				<div className="h-full flex justify-around items-center px-5 py-4">
					<HistoryToggleButton isLabelVisible={true} />
					<DocumentsToggleButton />
					<NewChatMobileButton />
					<AppNavItems />
				</div>
			</aside>
		</div>
	);
};
