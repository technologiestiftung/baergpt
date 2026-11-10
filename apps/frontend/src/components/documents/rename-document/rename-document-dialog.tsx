import React from "react";
import { useDocumentsListStore } from "../../../store/use-documents-list-store.ts";
import { useUserDocumentStore } from "../../../store/use-user-document-store.ts";
import { isPersonalDocument } from "../document-list/list-item/utils/is-personal-document.ts";
import { getFileExtension } from "../document-list/list-item/utils/get-file-extension.ts";
import {
	RenameItemDialog,
	showRenameItemDialog,
} from "../rename-item/rename-item-dialog.tsx";
import { SUPPORTED_UPLOAD_FILE_TYPES } from "../../../lib/upload-file-types.ts";
import Content from "../../../content.ts";

const renameDocumentDialogId = "rename-document-dialog";

const MAX_DOCUMENT_NAME_LENGTH = 100;

const SUPPORTED_FILE_EXTENSIONS = Object.values(
	SUPPORTED_UPLOAD_FILE_TYPES,
).flat();

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

	const endsWithExtension = (name: string, extension: string) =>
		name.toLowerCase().endsWith(extension.toLowerCase());

	const keepOriginalExtension = (name: string) => {
		if (!originalExtension) {
			return name;
		}
		const baseName = (
			endsWithExtension(name, originalExtension)
				? name.slice(0, -originalExtension.length)
				: name
		).trim();
		return baseName ? `${baseName}${originalExtension}` : "";
	};

	const getNameError = (newName: string, rawName: string) => {
		const changesExtension =
			originalExtension &&
			!endsWithExtension(rawName, originalExtension) &&
			SUPPORTED_FILE_EXTENSIONS.some((extension) =>
				endsWithExtension(rawName, extension),
			);
		if (changesExtension) {
			return Content["renameDocumentDialog.error.extensionChanged"].replace(
				"{extension}",
				originalExtension,
			);
		}

		return userDocuments.some(
			(doc) =>
				doc.id !== userDocument?.id &&
				doc.file_name === newName &&
				!deletedDefaultDocumentIds.includes(doc.id),
		)
			? Content["renameDocumentDialog.error.duplicate"]
			: "";
	};

	return (
		<RenameItemDialog
			id={renameDocumentDialogId}
			title={Content["renameDocumentDialog.title"]}
			item={userDocument ? { id: userDocument.id, name: fileName } : null}
			onRename={renameUserDocument}
			failureMessage={Content["renameDocumentDialog.error.failed"]}
			maxLength={MAX_DOCUMENT_NAME_LENGTH}
			getNameError={getNameError}
			normalizeName={keepOriginalExtension}
			selectBaseNameOnly
		/>
	);
};
