import React, { useEffect, useRef, useState } from "react";
import { useAuthStore } from "../../../store/auth-store";
import { DesktopProfileDropdown } from "../desktop-profile-dropdown/desktop-profile-dropdown";
import Content from "../../../content";

export const DesktopProfileButton = () => {
	const { session } = useAuthStore();
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);
	const dropdownRef = useRef<HTMLDivElement>(null);
	const buttonRef = useRef<HTMLButtonElement>(null);

	const toggleDropdown = (event: React.MouseEvent) => {
		event.stopPropagation();
		setIsDropdownOpen((prev) => !prev);
	};

	useEffect(() => {
		if (!isDropdownOpen) {
			return () => {};
		}

		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as Node;
			if (
				dropdownRef.current?.contains(target) ||
				buttonRef.current?.contains(target)
			) {
				return;
			}
			setIsDropdownOpen(false);
		};

		const handleEscapeKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setIsDropdownOpen(false);
				buttonRef.current?.focus();
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		document.addEventListener("keydown", handleEscapeKey);

		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
			document.removeEventListener("keydown", handleEscapeKey);
		};
	}, [isDropdownOpen]);

	if (!session) {
		return null;
	}

	const { first_name, last_name } = session.user.user_metadata;

	return (
		<>
			<button
				ref={buttonRef}
				onClick={toggleDropdown}
				className="group flex items-center justify-center focus-visible:outline-default"
				aria-haspopup="true"
				aria-expanded={isDropdownOpen}
				aria-label={Content["profile.button.ariaLabel"]}
			>
				<div
					className={`flex items-center rounded-full size-9 p-2 group-hover:bg-hellblau-100 ${isDropdownOpen ? "bg-hellblau-100 group-hover:bg-hellblau-60" : "bg-hellblau-60"}`}
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
