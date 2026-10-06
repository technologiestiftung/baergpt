import React from "react";
import { HistoryToggleButton } from "./sidebar-buttons/history-toggle-button";
import { DocumentsToggleButton } from "./sidebar-buttons/documents-toggle-button";
import { NewChatMobileButton } from "./sidebar-buttons/new-chat-mobile-button";
import { MobileProfileButton } from "../profile/profile-buttons/mobile-profile-button.tsx";
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
					<a
						href={Content["header.navigation.help.link"]}
						className="flex md:hidden flex-col items-center justify-center gap-1 size-[52px] p-2 rounded-sm text-sm leading-5 font-normal text-hellblau-50 md:hover:bg-dunkelblau-80 focus-visible:outline-default"
						aria-label={Content["header.navigation.help.ariaLabel"]}
						target="_blank"
						rel="noopener noreferrer"
					>
						<img
							src="/icons/help-light-icon.svg"
							alt=""
							width={24}
							height={24}
						/>
						{Content["header.navigation.help.mobileLabel"]}
					</a>
					<MobileProfileButton />
				</div>
			</aside>
		</div>
	);
};
