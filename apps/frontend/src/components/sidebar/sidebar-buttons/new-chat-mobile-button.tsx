import React from "react";
import { useCurrentChatIdStore } from "../../../store/current-chat-id-store";
import Content from "../../../content";
import { useDrawerStore } from "../../../store/drawer-store";

export const NewChatMobileButton: React.FC = () => {
	const { setCurrentChatId } = useCurrentChatIdStore();
	const { setOpenDrawer } = useDrawerStore();

	return (
		<>
			<button
				aria-label={Content["newChatButton.ariaLabel"]}
				className="rounded-sm px-3 py-1 border border-hellblau-50 focus-visible:outline-default flex-shrink-0"
				onClick={() => {
					setCurrentChatId(null);
					setOpenDrawer(null);
				}}
			>
				<div className="px-1">
					<img
						src="icons/plus-light-icon.svg"
						alt="Plus-Icon"
						width={24}
						height={24}
					/>
				</div>
			</button>
		</>
	);
};
