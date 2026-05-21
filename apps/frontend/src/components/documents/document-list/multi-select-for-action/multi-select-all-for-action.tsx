import React from "react";
import { useUserFolderStore } from "../../../../store/use-user-folder-store.ts";
import { useUserDocumentStore } from "../../../../store/use-user-document-store.ts";
import Content from "../../../../content.ts";
import { IndeterminateCheckbox } from "../../../primitives/checkboxes/indeterminate-checkbox.tsx";
import { useMultiSelectCheckboxState } from "./use-multi-select-checkbox-state.tsx";
import type { CheckboxState } from "../../../primitives/icons/checkbox-icon.tsx";

export const MultiSelectAllForAction: React.FC = () => {
	const {
		selectedUserFoldersForAction,
		getUserItemsInCurrentFolder,
		unselectAllItemsForActionInCurrentFolder,
		selectAllItemsForActionInCurrentFolder,
	} = useUserFolderStore();
	const { selectedUserDocumentsForAction } = useUserDocumentStore();

	const selectedItemsForAction = [
		...selectedUserFoldersForAction,
		...selectedUserDocumentsForAction,
	];
	const userItemsInCurrentFolder = getUserItemsInCurrentFolder();

	const checkboxState = useMultiSelectCheckboxState(
		selectedItemsForAction,
		userItemsInCurrentFolder,
	);

	const handleChange = (newState: CheckboxState) => {
		if (newState === "checked") {
			selectAllItemsForActionInCurrentFolder();
		}
		if (newState === "unchecked") {
			unselectAllItemsForActionInCurrentFolder();
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
