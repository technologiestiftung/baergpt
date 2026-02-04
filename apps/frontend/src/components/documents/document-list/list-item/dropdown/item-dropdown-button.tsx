import React, { useState, useRef } from "react";
import { useClickOutside } from "../../../../../hooks/use-click-outside";
import { ItemDropdown } from "./item-dropdown";
import Content from "../../../../../content";
import type { Document, DocumentFolder } from "../../../../../common";

interface ItemDropdownButtonProps {
	item: Document | DocumentFolder;
}

export const ItemDropdownButton: React.FC<ItemDropdownButtonProps> = ({
	item,
}) => {
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);
	const dropdownButtonRef = useRef<HTMLButtonElement>(null);
	const dropdownRef = useRef<HTMLDivElement>(null);

	useClickOutside(isDropdownOpen, () => setIsDropdownOpen(false), [
		dropdownButtonRef,
		dropdownRef,
	]);

	const handleOpenMenu = () => {
		setIsDropdownOpen(!isDropdownOpen);
	};

	return (
		<div className="relative" ref={dropdownRef}>
			<button
				ref={dropdownButtonRef}
				type="button"
				className="flex items-center p-[7px] hover:bg-hellblau-100 rounded-3px group-hover:opacity-100 focus-within:opacity-100 opacity-0 transition-opacity duration-150"
				aria-label={Content["documentsList.menuIcon.ariaLabel"]}
				onClick={handleOpenMenu}
			>
				<img
					src="/icons/dot-menu-icon.svg"
					alt={Content["documentsList.menuIcon.imgAlt"]}
					width={18}
					height={18}
				/>
			</button>
			<ItemDropdown
				item={item}
				isOpen={isDropdownOpen}
				onClose={() => setIsDropdownOpen(false)}
			/>
		</div>
	);
};
