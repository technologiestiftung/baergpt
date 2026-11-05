import React, { useLayoutEffect, useRef } from "react";
import useExportDropdownPosition from "../../hooks/use-export-dropdown-position.ts";

interface ExportDropdownMenuProps {
	buttonRef: React.RefObject<HTMLButtonElement | null>;
	onClose: () => void;
	children: React.ReactNode;
}

export const ExportDropdownMenu: React.FC<ExportDropdownMenuProps> = ({
	buttonRef,
	onClose,
	children,
}) => {
	const menuRef = useRef<HTMLDivElement | null>(null);
	const { coords, updateCoords } = useExportDropdownPosition(
		buttonRef,
		menuRef,
	);

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
		<>
			<div className="fixed inset-0 z-10" onMouseDown={onClose} />
			<div
				ref={menuRef}
				className="fixed z-50 bg-white rounded-[3px] shadow-custom-shadow shadow-dunkelblau-100/10 text-sm leading-5 text-dunkelblau-80"
				style={{
					left: coords ? `${coords.left}px` : undefined,
					top: coords ? `${coords.top}px` : undefined,
					minWidth: coords ? `${coords.minWidth}px` : undefined,
				}}
				onKeyDown={(event) => {
					if (event.key === "Escape") {
						onClose();
						buttonRef.current?.focus();
					}
				}}
			>
				{children}
			</div>
		</>
	);
};
