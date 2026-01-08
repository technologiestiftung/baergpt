import { useEffect, type RefObject } from "react";

/**
 * Custom hook to handle closing a dropdown/modal when clicking outside or pressing Escape
 * @param isOpen - Whether the dropdown/modal is currently open
 * @param onClose - Callback to close the dropdown/modal
 * @param refs - Array of refs to elements that should not trigger close when clicked
 */
export function useClickOutside(
	isOpen: boolean,
	onClose: () => void,
	refs: Array<RefObject<HTMLElement | null>>,
) {
	useEffect(() => {
		if (!isOpen) {
			return undefined;
		}

		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as Node;
			const isClickInside = refs.some((ref) => ref.current?.contains(target));

			if (!isClickInside) {
				onClose();
			}
		};

		const handleEscapeKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				onClose();
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		document.addEventListener("keydown", handleEscapeKey);

		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
			document.removeEventListener("keydown", handleEscapeKey);
		};
	}, [isOpen, onClose, refs]);
}
