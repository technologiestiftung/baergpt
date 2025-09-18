import React, { useState } from "react";

function useExportDropdownPosition(
	buttonRef: React.RefObject<HTMLButtonElement>,
) {
	const [coords, setCoords] = useState<{
		top: number;
		left: number;
		minWidth?: number;
	} | null>(null);

	const updateCoords = () => {
		if (buttonRef.current) {
			const rect = buttonRef.current.getBoundingClientRect();
			setCoords({
				top: rect.bottom + window.scrollY,
				left: rect.left + window.scrollX,
				minWidth: rect.width,
			});
		}
	};

	return { coords, updateCoords };
}
export default useExportDropdownPosition;
