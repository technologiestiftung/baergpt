import React, { useLayoutEffect } from "react";
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
	const { coords, updateCoords } = useExportDropdownPosition(buttonRef);

	useLayoutEffect(updateCoords, []);

	return (
		<>
			<div className="fixed inset-0 z-10" onMouseDown={onClose} />
			<div
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
