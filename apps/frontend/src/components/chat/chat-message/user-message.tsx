import type { ReactNode } from "react";
import type { ChatMessage } from "../../../common.ts";
import { useDocumentStore } from "../../../store/document-store.ts";
import { useFolderStore } from "../../../store/folder-store.ts";
import { ChatItemPills } from "./chat-item-pills.tsx";
import { CopyToClipboardButton } from "./copy-to-clipboard-button.tsx";

type UserMessageProps = {
	message: ChatMessage;
	children: string | ReactNode;
};

export function UserMessage({ message, children }: UserMessageProps) {
	const { folders } = useFolderStore();
	const { documents } = useDocumentStore();

	const { allowed_folder_ids, allowed_document_ids, content } = message;

	const foundFolders = folders.filter((folder) =>
		allowed_folder_ids?.includes(folder.id),
	);
	const foundDocuments = documents.filter((document) =>
		allowed_document_ids?.includes(document.id),
	);

	const foundItems = [...foundFolders, ...foundDocuments];

	return (
		<div className={`flex flex-col self-end items-end w-full gap-y-1 group`}>
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
