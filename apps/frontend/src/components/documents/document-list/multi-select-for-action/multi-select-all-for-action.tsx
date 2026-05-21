import React from "react";
import { useUserFolderStore } from "../../../../store/use-user-folder-store.ts";
import { useUserDocumentStore } from "../../../../store/use-user-document-store.ts";
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
	} = useUserFolderStore();
	const { selectedUserDocumentsForAction } = useUserDocumentStore();

	const selectedItemsForAction = [
		...selectedFoldersForAction,
		...selectedUserDocumentsForAction,
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
