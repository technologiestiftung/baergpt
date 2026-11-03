import React from "react";
import { useUserFolderStore } from "../../../store/use-user-folder-store.ts";
import { useUserDocumentStore } from "../../../store/use-user-document-store.ts";
import { SelectedItemPill } from "./selected-item-pill";
import { SelectedChatItemsLabel } from "./selected-chat-items-label.tsx";
import { useIsCollapsibleOpen } from "./hooks/use-is-collapsible-open.tsx";
import { getListItemName } from "../../documents/document-list/list-item/utils/get-list-item-name.ts";
import { usePublicDocumentsStore } from "../../../store/use-public-documents-store.ts";
import { useFileUploadsStore } from "../../../store/use-file-uploads-store.ts";
import { useChatFileUploadPills } from "./hooks/use-chat-file-uploads.ts";
import { FileUploadPill } from "./file-upload-pill.tsx";

export const SelectedChatItemsCollapsible: React.FC = () => {
	const {
		selectedUserChatFolders: selectedUserChatFolders,
		unselectUserChatFolder: unselectUserChatFolder,
	} = useUserFolderStore();
	const {
		selectedPublicChatDocuments,
		unselectPublicChatDocument,
		selectedPublicChatFolders,
		unselectPublicChatFolder,
	} = usePublicDocumentsStore();
	const { selectedUserChatDocuments, unselectUserChatDocument } =
		useUserDocumentStore();
	const { removeFileUploadFromChat } = useFileUploadsStore();
	const chatFileUploads = useChatFileUploadPills();

	const hasSelectedChatItems =
		selectedUserChatFolders.length > 0 ||
		selectedUserChatDocuments.length > 0 ||
		selectedPublicChatFolders.length > 0 ||
		selectedPublicChatDocuments.length > 0 ||
		chatFileUploads.length > 0;

	const [isCollapsibleOpen, setIsCollapsibleOpen] = useIsCollapsibleOpen(
		chatFileUploads.length,
	);

	if (!hasSelectedChatItems) {
		return null;
	}

	return (
		<button
			type="button"
			disabled={!hasSelectedChatItems}
			onClick={() => setIsCollapsibleOpen(!isCollapsibleOpen)}
			className={`
				flex flex-col items-start justify-center gap-y-3 w-full px-3 py-1.5
				bg-hellblau-30 rounded-t-3px text-sm leading-5 text-dunkelblau-80
				focus-visible:outline-2px hover:bg-hellblau-50 ${isCollapsibleOpen && "pb-2.5"}`}
			aria-expanded={isCollapsibleOpen}
		>
			{!isCollapsibleOpen && (
				<SelectedChatItemsLabel chatFileUploads={chatFileUploads} />
			)}

			{isCollapsibleOpen && (
				<div className="flex flex-wrap gap-2 max-h-20 overflow-auto pt-1 pl-1 pb-0.5">
					{selectedPublicChatFolders.map((item) => (
						<SelectedItemPill
							key={`${item.id}-${item.name}`}
							id={item.id}
							name={item.name}
							isFolder={true}
							onRemove={unselectPublicChatFolder}
						/>
					))}

					{selectedPublicChatDocuments.map((item) => (
						<SelectedItemPill
							key={`${item.id}-${item.file_name}`}
							id={item.id}
							name={getListItemName(item)}
							isFolder={false}
							onRemove={unselectPublicChatDocument}
						/>
					))}

					{selectedUserChatFolders.map((item) => (
						<SelectedItemPill
							key={`${item.id}-${item.name}`}
							id={item.id}
							name={getListItemName(item)}
							isFolder={true}
							onRemove={unselectUserChatFolder}
						/>
					))}

					{selectedUserChatDocuments.map((item) => (
						<SelectedItemPill
							key={`${item.id}-${item.file_name}`}
							id={item.id}
							name={getListItemName(item)}
							isFolder={false}
							onRemove={unselectUserChatDocument}
						/>
					))}

					{chatFileUploads.map(({ file, status }) => (
						<FileUploadPill
							key={`upload-${file.name}`}
							name={file.name}
							status={status}
							onRemove={removeFileUploadFromChat}
						/>
					))}
				</div>
			)}
		</button>
	);
};
