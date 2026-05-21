import type { ReactNode } from "react";
import type { ChatMessage } from "../../../common.ts";
import { useUserDocumentStore } from "../../../store/use-user-document-store.ts";
import { useUserFolderStore } from "../../../store/use-user-folder-store.ts";
import { ChatItemPills } from "./chat-item-pills.tsx";
import { CopyToClipboardButton } from "./copy-to-clipboard-button.tsx";
import { usePublicDocumentsStore } from "../../../store/use-public-documents-store.ts";

type UserMessageProps = {
	message: ChatMessage;
	children: string | ReactNode;
};

export function UserMessage({ message, children }: UserMessageProps) {
	const { userFolders } = useUserFolderStore();
	const { userDocuments } = useUserDocumentStore();
	const { publicDocuments, publicFolders } = usePublicDocumentsStore();

	const { allowed_folder_ids, allowed_document_ids, content } = message;

	const foundUserFolders = userFolders.filter((folder) =>
		allowed_folder_ids?.includes(folder.id),
	);
	const foundUserDocuments = userDocuments.filter((document) =>
		allowed_document_ids?.includes(document.id),
	);
	const foundPublicDocuments = publicDocuments.filter((document) =>
		allowed_document_ids?.includes(document.id),
	);

	/**
	 * if all public documents have been added to the message,
	 * we show the (fake) folder instead of individual documents
	 */
	const foundPublicItems =
		publicDocuments.length > 0 &&
		foundPublicDocuments.length === publicDocuments.length
			? publicFolders
			: foundPublicDocuments;

	const foundItems = [
		...foundUserFolders,
		...foundUserDocuments,
		...foundPublicItems,
	];

	return (
		<div
			className={`flex flex-col self-end items-end w-full gap-y-1 group`}
			data-testid="user-message-markdown-container"
		>
			<ChatItemPills items={foundItems} />

			<div className="bg-hellblau-30 px-2.5 rounded-3px w-fit  max-w-[85%] md:max-w-[80%]">
				{children}
			</div>
			<div
				className={`group-hover:opacity-100 focus-within:opacity-100 opacity-0 transition-opacity duration-150`}
			>
				<CopyToClipboardButton generatedAnswer={content} />
			</div>
		</div>
	);
}
