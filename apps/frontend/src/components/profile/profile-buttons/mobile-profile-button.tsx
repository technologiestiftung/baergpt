import React from "react";
import { useDrawerStore } from "../../../store/drawer-store";
import Content from "../../../content";
import { useAuthStore } from "../../../store/auth-store";

export const MobileProfileButton: React.FC = () => {
	const { session } = useAuthStore();
	const { openDrawerId, setOpenDrawer } = useDrawerStore();
	const isProfileSectionOpen = openDrawerId === "profile";

	const handleToggle = () => {
		setOpenDrawer(isProfileSectionOpen ? null : "profile");
	};

	if (!session) {
		return null;
	}

	const { first_name, last_name } = session.user.user_metadata;
	return (
		<button
			onClick={handleToggle}
			className={`flex md:hidden flex-col gap-1 items-center justify-center size-[52px] p-2 rounded-sm 
			text-sm leading-5 font-normal text-hellblau-50 md:hover:bg-dunkelblau-80 focus-visible:outline-default
				${isProfileSectionOpen ? "bg-hellblau-50" : "bg-dunkelblau-100 "}`}
			aria-label={Content["profile.button.ariaLabel"]}
		>
			<div
				className={`flex items-center justify-center size-6 p-2 rounded-full
				${isProfileSectionOpen ? "bg-dunkelblau-100" : "bg-hellblau-50"}`}
			>
				<span
					className={`flex text-xs items-center justify-center size-6 text-dunkelblau-200 font-bold leading-6 uppercase
					${isProfileSectionOpen ? "text-hellblau-50" : "text-dunkelblau-100"}`}
				>
					{first_name?.[0]?.toUpperCase() ?? ""}
					{last_name?.[0]?.toUpperCase() ?? ""}
				</span>
			</div>

			<span
				className={`${isProfileSectionOpen ? "text-dunkelblau-100" : "text-hellblau-50"}`}
			>
				{Content["header.navigation.profile"]}
			</span>
		</button>
	);
};
