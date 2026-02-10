import React from "react";

import { useFolderStore } from "../../../../store/folder-store";
import { useDocumentsListStore } from "../../../../store/use-documents-list-store.ts";
import { SecondaryButton } from "../../../primitives/buttons/secondary-button.tsx";
import Content from "../../../../content.ts";
import { PrimaryButton } from "../../../primitives/buttons/primary-button.tsx";
import { CloseIcon } from "../../../primitives/icons/close-icon.tsx";
import { CheckboxIcon } from "../../../primitives/icons/checkbox-icon.tsx";

export const MultiSelectForActionButton: React.FC = () => {
	const { unselectAllItemsInCurrentFolder } = useFolderStore();
	const {
		showMultiSelectForAction,
		hideMultiSelectForAction,
		isMultiSelectForActionVisible,
	} = useDocumentsListStore();

	return (
		<>
			{isMultiSelectForActionVisible ? (
				<PrimaryButton
					onClick={() => {
						unselectAllItemsInCurrentFolder();
						hideMultiSelectForAction();
					}}
					hasIcon="right"
				>
					{Content["multiSelectForAction.cancel.label"]}
					<CloseIcon variant="white" className="size-5" />
				</PrimaryButton>
			) : (
				<SecondaryButton onClick={() => showMultiSelectForAction()}>
					<CheckboxIcon state="checked" />
					{Content["deleteItemButton.label"]}
				</SecondaryButton>
			)}
		</>
	);
};
