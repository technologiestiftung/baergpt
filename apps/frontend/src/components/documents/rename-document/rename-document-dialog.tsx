import React from "react";
import { useDocumentsListStore } from "../../../store/use-documents-list-store.ts";
import { useUserDocumentStore } from "../../../store/use-user-document-store.ts";
import { isPersonalDocument } from "../document-list/list-item/utils/is-personal-document.ts";
import { getFileExtension } from "../document-list/list-item/utils/get-file-extension.ts";
import {
	RenameItemDialog,
	showRenameItemDialog,
} from "../rename-item/rename-item-dialog.tsx";
import Content from "../../../content.ts";

const renameDocumentDialogId = "rename-document-dialog";

const MAX_DOCUMENT_NAME_LENGTH = 100;

const SUPPORTED_FILE_EXTENSIONS = [".pdf", ".docx", ".xlsx", ".csv"];

export function showRenameDocumentDialog() {
	showRenameItemDialog(renameDocumentDialogId);
}

export const RenameDocumentDialog: React.FC = () => {
	const singleItemSelectedForAction = useDocumentsListStore(
		(state) => state.singleItemSelectedForAction,
	);
	const userDocuments = useUserDocumentStore((state) => state.userDocuments);
	const deletedDefaultDocumentIds = useUserDocumentStore(
		(state) => state.deletedDefaultDocumentIds,
	);
	const renameUserDocument = useUserDocumentStore(
		(state) => state.renameUserDocument,
	);

	const userDocument = isPersonalDocument(singleItemSelectedForAction)
		? singleItemSelectedForAction
		: null;

	const fileName = userDocument?.file_name ?? "";
	const originalExtension = getFileExtension(fileName);

	// Only strip known extensions, so a name like "Bericht v1.2" keeps its ".2"
	const keepOriginalExtension = (name: string) => {
		const typedExtension = [originalExtension, ...SUPPORTED_FILE_EXTENSIONS]
			.filter(Boolean)
			.find((extension) =>
				name.toLowerCase().endsWith(extension.toLowerCase()),
			);
		const baseName = (
			typedExtension ? name.slice(0, -typedExtension.length) : name
		).trim();
		return baseName ? `${baseName}${originalExtension}` : "";
	};

	const getDuplicateNameError = (newName: string) =>
		userDocuments.some(
			(doc) =>
				doc.id !== userDocument?.id &&
				doc.file_name === newName &&
				!deletedDefaultDocumentIds.includes(doc.id),
		)
			? Content["renameDocumentDialog.error.duplicate"]
			: "";

	return (
		<RenameItemDialog
			id={renameDocumentDialogId}
			title={Content["renameDocumentDialog.title"]}
			item={userDocument ? { id: userDocument.id, name: fileName } : null}
			onRename={renameUserDocument}
			failureMessage={Content["renameDocumentDialog.error.failed"]}
			maxLength={MAX_DOCUMENT_NAME_LENGTH}
			getNameError={getDuplicateNameError}
			normalizeName={keepOriginalExtension}
			selectBaseNameOnly
		/>
	);
};
