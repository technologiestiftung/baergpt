import React, { useRef, useState, useCallback } from "react";
import { useAuthStore } from "../../../store/auth-store";
import { DesktopProfileDropdown } from "../desktop-profile-dropdown/desktop-profile-dropdown";
import Content from "../../../content";
import { useClickOutside } from "../../../hooks/use-click-outside";
import { useDrawerStore } from "../../../store/drawer-store";
import { useTooltipStore } from "../../../store/tooltip-store";

export const DesktopProfileButton = () => {
	const { session } = useAuthStore();
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);
	const dropdownRef = useRef<HTMLDivElement>(null);
	const buttonRef = useRef<HTMLButtonElement>(null);
	const { openDrawerId } = useDrawerStore();
	const isHistorySidebarOpen = openDrawerId === "history";
	const { showTooltip, hideTooltip } = useTooltipStore();

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

	const handleInteractionStart = (
		event: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>,
		tooltipLabel: string,
	) => {
		if (isHistorySidebarOpen) {
			return;
		}

		showTooltip({ event, content: tooltipLabel, isLight: true });
	};

	if (!session) {
		return null;
	}

	const { first_name, last_name } = session.user.user_metadata;

	return (
		<div className="relative w-full">
			<button
				ref={buttonRef}
				onClick={toggleDropdown}
				className={`
					group flex items-center  py-1.5 w-full overflow-hidden
					focus-visible:outline-default rounded-3px hover:bg-dunkelblau-90
					 ${isHistorySidebarOpen ? "px-2 justify-between" : "px-0.5"}
					 ${isDropdownOpen ? "bg-dunkelblau-90" : ""}
				 `}
				aria-haspopup="true"
				aria-expanded={isDropdownOpen}
				aria-label={Content["profile.button.ariaLabel"]}
				onMouseEnter={(event) =>
					handleInteractionStart(event, Content["profile.button.tooltipLabel"])
				}
				onMouseLeave={hideTooltip}
				onFocus={(event) =>
					handleInteractionStart(event, Content["profile.button.tooltipLabel"])
				}
				onBlur={hideTooltip}
			>
				<div className="flex gap-1.5 items-center">
					<div
						className={`flex shrink-0 items-center justify-center rounded-full p-1.5 bg-hellblau-50 size-7`}
					>
						<span className="text-center text-dunkelblau-100 text-xs font-semibold leading-4 uppercase">
							{first_name?.[0]?.toUpperCase() ?? ""}
							{last_name?.[0]?.toUpperCase() ?? ""}
						</span>
					</div>
					<span
						className={`text-hellblau-50 text-sm leading-[14px] font-bold truncate transition-opacity ${isHistorySidebarOpen ? "opacity-100 duration-200" : "opacity-0 duration-100"}`}
						aria-hidden={!isHistorySidebarOpen}
					>
						{first_name} {last_name}
					</span>
				</div>
				<img
					src="/icons/arrow-drop-down-icon-light.svg"
					alt=""
					width={24}
					height={24}
					className={`transition-opacity ${isDropdownOpen ? "rotate-180" : ""} ${isHistorySidebarOpen ? "opacity-100 duration-200" : "opacity-0 duration-100"}`}
				/>
			</button>

			{isDropdownOpen && <DesktopProfileDropdown ref={dropdownRef} />}
		</div>
	);
};
