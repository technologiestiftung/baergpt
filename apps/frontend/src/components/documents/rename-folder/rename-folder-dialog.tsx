import React from "react";
import { useDocumentsListStore } from "../../../store/use-documents-list-store.ts";
import { useUserFolderStore } from "../../../store/use-user-folder-store.ts";
import { isUserFolder } from "../document-list/list-item/utils/is-user-folder.ts";
import {
	RenameItemDialog,
	showRenameItemDialog,
} from "../rename-item/rename-item-dialog.tsx";
import Content from "../../../content.ts";

const renameFolderDialogId = "rename-folder-dialog";

export function showRenameFolderDialog() {
	showRenameItemDialog(renameFolderDialogId);
}

export const RenameFolderDialog: React.FC = () => {
	const singleItemSelectedForAction = useDocumentsListStore(
		(state) => state.singleItemSelectedForAction,
	);
	const renameUserFolder = useUserFolderStore(
		(state) => state.renameUserFolder,
	);

	const folder = isUserFolder(singleItemSelectedForAction)
		? singleItemSelectedForAction
		: null;

	return (
		<RenameItemDialog
			id={renameFolderDialogId}
			title={Content["renameFolderDialog.title"]}
			item={folder}
			onRename={renameUserFolder}
			failureMessage={Content["renameFolderDialog.error.failed"]}
		/>
	);
};
