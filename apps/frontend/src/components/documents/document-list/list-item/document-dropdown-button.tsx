import React, { useState, useRef } from "react";
import type { Document } from "../../../../common";
import { useClickOutside } from "../../../../hooks/use-click-outside";
import { DocumentDropdown } from "./document-dropdown";
import Content from "../../../../content";

interface DocumentDropdownButtonProps {
	document: Document;
}

export const DocumentDropdownButton: React.FC<DocumentDropdownButtonProps> = ({
	document,
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
			<DocumentDropdown
				document={document}
				isOpen={isDropdownOpen}
				onClose={() => setIsDropdownOpen(false)}
			/>
		</div>
	);
};
