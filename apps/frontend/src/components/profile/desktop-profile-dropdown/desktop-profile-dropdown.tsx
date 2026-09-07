import React from "react";
import Content from "../../../content";
import { useAuthStore } from "../../../store/auth-store";
import { useFileUploadsStore } from "../../../store/use-file-uploads-store";
import { DesktopProfileDropdownItem } from "./desktop-profile-dropdown-item";

export const DesktopProfileDropdown = React.forwardRef<HTMLDivElement>(
	(_, ref) => {
		const { session, logout, isUserAdmin } = useAuthStore();
		const { clearFileUploads } = useFileUploadsStore();
		const adminLink = import.meta.env.VITE_ADMIN_URL;

		if (!session) {
			return null;
		}

		return (
			<div
				ref={ref}
				className="absolute bottom-full mb-0.5 flex flex-col items-center left-0 z-50 p-1 w-full rounded-[3px] bg-hellblau-30 text-dunkelblau-80"
			>
				{/* Profile */}
				<DesktopProfileDropdownItem
					icon="/icons/profile-icon-light.svg"
					label={Content["profile.title"]}
					href="/profile/"
				/>
				{/* Admin */}
				{isUserAdmin && (
					<DesktopProfileDropdownItem
						icon="/icons/admin-icon-light.svg"
						label={Content["admin.button.link.label"]}
						href={adminLink}
					/>
				)}
				<span className="h-[0.5px] w-[calc(100%-24px)] bg-hellblau-100 px-3" />
				{/* Imprint & Privacy */}
				<DesktopProfileDropdownItem
					type="link"
					icon="/icons/imprint-icon-light.svg"
					label={Content["sidebar.navigation.imprint"]}
					href={Content["sidebar.navigation.imprint.link"]}
					openInNewTab={true}
					ariaLabel={Content["sidebar.navigation.imprint.ariaLabel"]}
				/>
				<DesktopProfileDropdownItem
					type="link"
					icon="/icons/lock-icon-light.svg"
					label={Content["sidebar.navigation.privacy"]}
					href={Content["sidebar.navigation.privacy.link"]}
					ariaLabel={Content["sidebar.navigation.privacy.ariaLabel"]}
				/>
				<span className="h-[0.5px] w-[calc(100%-24px)] bg-hellblau-100" />

				{/* Logout */}
				<DesktopProfileDropdownItem
					type="button"
					icon="/icons/logout-icon-light.svg"
					label={Content["profile.button.logout.label"]}
					onClick={() => {
						clearFileUploads();
						logout();
					}}
					ariaLabel={Content["profile.button.logout.ariaLabel"]}
				/>
			</div>
		);
	},
);
