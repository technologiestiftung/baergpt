import { useUserFolderStore } from "../../../store/use-user-folder-store.ts";
import { useUserDocumentStore } from "../../../store/use-user-document-store.ts";
import Content from "../../../content.ts";
import { isDocument } from "../../documents/document-list/list-item/utils/is-document.ts";
import type { ListItem } from "../../documents/document-list/list-item/utils/types.ts";
import { usePublicDocumentsStore } from "../../../store/use-public-documents-store.ts";
import {
	type FileUpload,
	isPendingUpload,
} from "../../../store/use-file-uploads-store.ts";
import { LoadingSpinnerIcon } from "../../primitives/icons/loading-spinner-icon.tsx";

export function SelectedChatItemsLabel({
	chatFileUploads,
}: {
	chatFileUploads: FileUpload[];
}) {
	const { selectedUserChatFolders: selectedUserChatFolders } =
		useUserFolderStore();
	const { selectedPublicChatFolders, selectedPublicChatDocuments } =
		usePublicDocumentsStore();
	const { selectedUserChatDocuments } = useUserDocumentStore();

	const selectedChatItems = [
		...selectedUserChatFolders,
		...selectedUserChatDocuments,
		...selectedPublicChatFolders,
		...selectedPublicChatDocuments,
	];
	const pendingUploadsAmount = chatFileUploads.filter(({ status }) =>
		isPendingUpload(status),
	).length;
	const selectedChatItemsAmount =
		selectedChatItems.length + pendingUploadsAmount;
	const hasPendingUploads = pendingUploadsAmount > 0;

	return (
		<span className="flex items-center gap-x-2 text-sm leading-5 text-dunkelblau-100">
			<span>
				<span className="font-semibold px-0.5">{selectedChatItemsAmount}</span>{" "}
				{getSelectedItemsLabel(selectedChatItems, pendingUploadsAmount)}
			</span>

			{hasPendingUploads && (
				<span className="flex items-center gap-x-1">
					<span aria-hidden="true" className="flex">
						<LoadingSpinnerIcon size="small" />
					</span>
					{Content["fileUploadButtonStatus.uploading"]}
				</span>
			)}
		</span>
	);
}

function getSelectedItemsLabel(
	selectedItems: ListItem[],
	fileUploadsAmount: number,
) {
	if (selectedItems.length + fileUploadsAmount !== 1) {
		return Content["chat.selectedChatItems.items"];
	}

	const item = selectedItems[0];
	if (fileUploadsAmount === 1 || isDocument(item)) {
		return Content["chat.selectedChatItems.document"];
	}

	return Content["chat.selectedChatItems.folder"];
}
