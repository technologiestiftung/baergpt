import React from "react";

import { useUserFolderStore } from "../../../../store/use-user-folder-store.ts";
import { useDocumentsListStore } from "../../../../store/use-documents-list-store.ts";
import { SecondaryButton } from "../../../primitives/buttons/secondary-button.tsx";
import Content from "../../../../content.ts";
import { PrimaryButton } from "../../../primitives/buttons/primary-button.tsx";
import { CloseIcon } from "../../../primitives/icons/close-icon.tsx";
import { CheckboxIcon } from "../../../primitives/icons/checkbox-icon.tsx";

export const MultiSelectForActionButton: React.FC = () => {
	const {
		unselectAllItemsForActionInCurrentFolder,
		getUserItemsInCurrentFolder,
	} = useUserFolderStore();
	const {
		showMultiSelectForAction,
		hideMultiSelectForAction,
		isMultiSelectForActionVisible,
	} = useDocumentsListStore();

	const hasItemsInCurrentFolder = getUserItemsInCurrentFolder().length > 0;

	return (
		<>
			{isMultiSelectForActionVisible ? (
				<PrimaryButton
					disabled={!hasItemsInCurrentFolder}
					onClick={() => {
						unselectAllItemsForActionInCurrentFolder();
						hideMultiSelectForAction();
					}}
					hasIcon="right"
				>
					{Content["multiSelectForAction.cancel.label"]}
					<CloseIcon variant="white" className="size-5" />
				</PrimaryButton>
			) : (
				<SecondaryButton
					disabled={!hasItemsInCurrentFolder}
					onClick={() => showMultiSelectForAction()}
				>
					<CheckboxIcon
						state={hasItemsInCurrentFolder ? "checked" : "disabled"}
					/>
					{Content["selectItemsButton.label"]}
				</SecondaryButton>
			)}
		</>
	);
};
