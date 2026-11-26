import React, { useState } from "react";

function useExportDropdownPosition(
	buttonRef: React.RefObject<HTMLButtonElement | null>,
	menuRef: React.RefObject<HTMLDivElement | null>,
	align: "left" | "right" = "left",
) {
	const [coords, setCoords] = useState<{
		top: number;
		left: number;
		minWidth?: number;
	} | null>(null);

	const updateCoords = () => {
		if (buttonRef.current) {
			const rect = buttonRef.current.getBoundingClientRect();
			const menuHeight = menuRef.current?.offsetHeight ?? 0;
			const menuWidth = menuRef.current?.offsetWidth ?? 0;
			const fitsBelow = rect.bottom + menuHeight <= window.innerHeight;
			setCoords({
				top: fitsBelow ? rect.bottom : rect.top - menuHeight,
				left: align === "left" ? rect.left : rect.right - menuWidth,
				minWidth: rect.width,
			});
		}
	};

	return { coords, updateCoords };
}
export default useExportDropdownPosition;
