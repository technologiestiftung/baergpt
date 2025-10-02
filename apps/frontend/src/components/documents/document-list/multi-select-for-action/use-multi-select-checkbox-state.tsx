import { useEffect, useState } from "react";
import type { Document, DocumentFolder } from "../../../../common.ts";
import type { CheckboxState } from "../../../primitives/icons/checkbox-icon.tsx";

export function useMultiSelectCheckboxState(
	selectedItemsForAction: (DocumentFolder | Document)[],
	itemsInCurrentFolder: (DocumentFolder | Document)[],
) {
	const [state, setState] = useState<CheckboxState>("unchecked");

	useEffect(() => {
		setState(
			getCheckboxState(
				selectedItemsForAction.length,
				itemsInCurrentFolder.length,
			),
		);
	}, [selectedItemsForAction, itemsInCurrentFolder]);

	return state;
}

function getCheckboxState(
	amountOfSelectedItemsForAction: number,
	totalAmountOfItemsInCurrentFolder: number,
) {
	if (amountOfSelectedItemsForAction === 0) {
		return "unchecked";
	}

	const hasSomeSelectedItems =
		amountOfSelectedItemsForAction > 0 &&
		amountOfSelectedItemsForAction < totalAmountOfItemsInCurrentFolder;

	if (hasSomeSelectedItems) {
		return "indeterminate";
	}

	return "checked";
}
