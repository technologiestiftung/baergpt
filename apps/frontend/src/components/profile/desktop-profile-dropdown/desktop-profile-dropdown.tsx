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

		const { first_name, last_name } = session.user.user_metadata;
		return (
			<div
				ref={ref}
				className="absolute right-5 z-50 mt-3 py-[5px] px-1 w-48 rounded-[3px] bg-hellblau-100 text-dunkelblau-100"
			>
				<div className="flex flex-col gap-3 justify-between">
					<div className="px-1 py-0.5 text-base leading-6 font-semibold border-b-[0.25px] border-dunkelblau-60">
						<span>
							{first_name} {last_name}
						</span>
					</div>
					<div className="flex flex-col gap-1">
						{/* Profile */}
						<DesktopProfileDropdownItem
							icon="/icons/profile-icon.svg"
							label={Content["profile.title"]}
							href="/profile/"
						/>
						{/* Admin */}
						{isUserAdmin && (
							<DesktopProfileDropdownItem
								icon="/icons/admin-icon.svg"
								label={Content["admin.button.link.label"]}
								href={adminLink}
							/>
						)}
						{/* Logout */}
						<DesktopProfileDropdownItem
							type="button"
							icon="/icons/logout-icon.svg"
							label={Content["profile.button.logout.label"]}
							onClick={() => {
								clearFileUploads();
								logout();
							}}
							ariaLabel={Content["profile.button.logout.ariaLabel"]}
						/>
					</div>
				</div>
			</div>
		);
	},
);
