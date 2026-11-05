import React, { useLayoutEffect, useRef } from "react";
import useExportDropdownPosition from "../../hooks/use-export-dropdown-position.ts";
import { useClickOutside } from "../../../../hooks/use-click-outside.ts";
import { useDropdownKeyboard } from "../../../../hooks/use-dropdown-keyboard.ts";
import { ExportButton } from "./export-button.tsx";

export interface ExportMenuItem {
	label: string;
	ariaLabel?: string;
	iconSrc?: string;
	onClick: () => void;
	testId?: string;
}

interface ExportDropdownMenuProps {
	buttonRef: React.RefObject<HTMLButtonElement | null>;
	onClose: () => void;
	items: ExportMenuItem[];
}

export const ExportDropdownMenu: React.FC<ExportDropdownMenuProps> = ({
	buttonRef,
	onClose,
	items,
}) => {
	const menuRef = useRef<HTMLDivElement | null>(null);
	const { coords, updateCoords } = useExportDropdownPosition(
		buttonRef,
		menuRef,
	);

	useClickOutside(true, onClose, [buttonRef, menuRef]);

	const { optionButtonRefs, handleKeyDown } = useDropdownKeyboard({
		items,
		isOpen: true,
		onClose: () => {
			onClose();
			buttonRef.current?.focus();
		},
		onItemClick: (item) => item.onClick(),
	});

	useLayoutEffect(() => {
		updateCoords();
		window.addEventListener("scroll", updateCoords, true);
		window.addEventListener("resize", updateCoords);
		return () => {
			window.removeEventListener("scroll", updateCoords, true);
			window.removeEventListener("resize", updateCoords);
		};
	}, []);

	return (
		<div
			ref={menuRef}
			className="fixed z-50 bg-white rounded-[3px] shadow-custom-shadow shadow-dunkelblau-100/10 text-sm leading-5 text-dunkelblau-80"
			style={{
				left: coords ? `${coords.left}px` : undefined,
				top: coords ? `${coords.top}px` : undefined,
				minWidth: coords ? `${coords.minWidth}px` : undefined,
			}}
			onKeyDown={handleKeyDown}
		>
			{items.map((item, index) => (
				<ExportButton
					key={item.label}
					ref={(el) => {
						if (el) {
							optionButtonRefs.current.set(index, el);
						} else {
							optionButtonRefs.current.delete(index);
						}
					}}
					label={item.label}
					ariaLabel={item.ariaLabel}
					iconSrc={item.iconSrc}
					onClick={item.onClick}
					testId={item.testId}
				/>
			))}
		</div>
	);
};
