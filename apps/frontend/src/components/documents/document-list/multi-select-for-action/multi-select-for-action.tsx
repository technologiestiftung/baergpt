import { IndeterminateCheckbox } from "../../../primitives/checkboxes/indeterminate-checkbox";
import { useFolderStore } from "../../../../store/folder-store";
import { useDocumentStore } from "../../../../store/document-store";
import { CheckboxState } from "../../../primitives/icons/checkbox-icon";
import { useMultiSelectCheckboxState } from "./use-multi-select-checkbox-state";
import Content from "../../../../content";

const {
	selectAllItemsInCurrentFolder,
	unselectAllItemsInCurrentFolder,
	getItemsInCurrentFolder,
} = useFolderStore.getState();

export function MultiSelectForAction() {
	const { selectedFoldersForAction } = useFolderStore();
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
			id={"multi-select-for-action"}
			state={checkboxState}
			onChange={handleChange}
		>
			{Content["documentsList.name"]}
		</IndeterminateCheckbox>
	);
}
