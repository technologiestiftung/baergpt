import React, { useRef, useState, useCallback } from "react";
import { useAuthStore } from "../../../store/auth-store";
import { DesktopProfileDropdown } from "../desktop-profile-dropdown/desktop-profile-dropdown";
import Content from "../../../content";
import { useClickOutside } from "../../../hooks/use-click-outside";

export const DesktopProfileButton = () => {
	const { session } = useAuthStore();
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);
	const dropdownRef = useRef<HTMLDivElement>(null);
	const buttonRef = useRef<HTMLButtonElement>(null);

	const toggleDropdown = (event: React.MouseEvent) => {
		event.stopPropagation();
		setIsDropdownOpen((prev) => !prev);
	};

	const handleClose = useCallback(() => {
		setIsDropdownOpen(false);
		// Focus the button when closing via Escape key
		buttonRef.current?.focus();
	}, []);

	useClickOutside(isDropdownOpen, handleClose, [buttonRef, dropdownRef]);

	if (!session) {
		return null;
	}

	const { first_name, last_name } = session.user.user_metadata;

	return (
		<>
			<button
				ref={buttonRef}
				onClick={toggleDropdown}
				className="group flex items-center justify-center focus-visible:outline-default rounded-3px"
				aria-haspopup="true"
				aria-expanded={isDropdownOpen}
				aria-label={Content["profile.button.ariaLabel"]}
			>
				<div
					className={`flex items-center rounded-full size-[33px] p-1 group-hover:bg-hellblau-100 ${isDropdownOpen ? "bg-hellblau-100 group-hover:bg-hellblau-60" : "bg-hellblau-60"}`}
				>
					<span className="text-center size-6 text-dunkelblau-200 text-sm font-bold leading-6 uppercase">
						{first_name?.[0]?.toUpperCase() ?? ""}
						{last_name?.[0]?.toUpperCase() ?? ""}
					</span>
				</div>

				<img
					src="/icons/arrow-drop-down-icon.svg"
					alt=""
					width={24}
					height={24}
				/>
			</button>

			{isDropdownOpen && <DesktopProfileDropdown ref={dropdownRef} />}
		</>
	);
};
