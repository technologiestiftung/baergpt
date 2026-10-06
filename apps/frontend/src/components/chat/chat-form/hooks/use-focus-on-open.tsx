import { type RefObject, useEffect } from "react";

export function useFocusOnOpen(
	isOpen: boolean,
	optionButtonRefs: RefObject<Map<number, HTMLButtonElement>>,
) {
	useEffect(() => {
		if (isOpen) {
			// set focus on first item when dropdown opens
			optionButtonRefs.current.get(0)?.focus();
		}
	}, [isOpen]);
}
