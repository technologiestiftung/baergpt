import React from "react";
import { useFolderStore } from "../../../../store/folder-store.ts";
import { useDocumentStore } from "../../../../store/document-store.ts";
import Content from "../../../../content.ts";
import { IndeterminateCheckbox } from "../../../primitives/checkboxes/indeterminate-checkbox.tsx";
import { useMultiSelectCheckboxState } from "./use-multi-select-checkbox-state.tsx";
import type { CheckboxState } from "../../../primitives/icons/checkbox-icon.tsx";

export const MultiSelectAllForAction: React.FC = () => {
	const {
		selectedFoldersForAction,
		getItemsInCurrentFolder,
		unselectAllItemsInCurrentFolder,
		selectAllItemsInCurrentFolder,
	} = useFolderStore();
	const { selectedDocumentsForAction } = useDocumentStore();

	const selectedItemsForAction = [
		...selectedFoldersForAction,
		...selectedDocumentsForAction,
	];
	const itemsInCurrentFolder = getItemsInCurrentFolder();

	const checkboxState = useMultiSelectCheckboxState(
		selectedItemsForAction,
		itemsInCurrentFolder,
	);

	const handleChange = (newState: CheckboxState) => {
		if (newState === "checked") {
			selectAllItemsInCurrentFolder();
		}
		if (newState === "unchecked") {
			unselectAllItemsInCurrentFolder();
		}
	};

	return (
		<IndeterminateCheckbox
			id="multi-select-for-action"
			state={checkboxState}
			onChange={handleChange}
		>
			{Content["documentsList.name"]}
		</IndeterminateCheckbox>
	);
};
