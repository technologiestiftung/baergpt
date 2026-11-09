import React, { useRef, useState } from "react";
import { useClickOutside } from "../../../../hooks/use-click-outside";
import { HistoryEntryDropdown } from "./history-entry-dropdown";
import Content from "../../../../content";
import type { Chat } from "../../../../common";

interface HistoryEntryDropdownButtonProps {
	chat: Chat;
	onRename: () => void;
}

export const HistoryEntryDropdownButton: React.FC<
	HistoryEntryDropdownButtonProps
> = ({ chat, onRename }) => {
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);
	const dropdownButtonRef = useRef<HTMLButtonElement>(null);
	const dropdownRef = useRef<HTMLDivElement>(null);

	useClickOutside(isDropdownOpen, () => setIsDropdownOpen(false), [
		dropdownButtonRef,
		dropdownRef,
	]);

	const closeDropdown = () => {
		// Closing unmounts the focused option, so focus would fall back to <body>
		const isFocusInDropdown = dropdownRef.current?.contains(
			document.activeElement,
		);
		setIsDropdownOpen(false);
		if (isFocusInDropdown) {
			dropdownButtonRef.current?.focus();
		}
	};

	return (
		<div className="relative" ref={dropdownRef}>
			<button
				ref={dropdownButtonRef}
				type="button"
				aria-label={Content["historyEntryDropdown.menuIcon.ariaLabel"]}
				aria-expanded={isDropdownOpen}
				className="rounded-3px size-5 flex items-center justify-center hover:bg-dunkelblau-95 group-hover:opacity-100 group-focus-within:opacity-100 aria-expanded:opacity-100 focus-visible:outline-2px hoverable:opacity-0 transition-opacity duration-150"
				onClick={() => setIsDropdownOpen((open) => !open)}
			>
				<img
					src="/icons/dot-menu-white-icon.svg"
					alt={Content["historyEntryDropdown.menuIcon.imgAlt"]}
					width={18}
					height={18}
				/>
			</button>
			<HistoryEntryDropdown
				chat={chat}
				isOpen={isDropdownOpen}
				onClose={closeDropdown}
				onRename={onRename}
				triggerRef={dropdownButtonRef}
			/>
		</div>
	);
};
