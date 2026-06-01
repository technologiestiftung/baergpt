import { useEffect, useState } from "react";
import type { Document, UserFolder } from "../../../../common.ts";
import type { CheckboxState } from "../../../primitives/icons/checkbox-icon.tsx";

export function useMultiSelectCheckboxState(
	selectedItemsForAction: (UserFolder | Document)[],
	itemsInCurrentFolder: (UserFolder | Document)[],
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
