import React, { type ReactNode, useState } from "react";
import { useUserDocumentStore } from "../../store/use-user-document-store.ts";
import type { UserDocument } from "../../common.ts";
import { useDrop } from "react-dnd";
import { AddToChatIcon } from "../primitives/icons/add-to-chat-icon.tsx";
import { isUserDocument } from "../documents/document-list/list-item/utils/is-user-document.ts";
import Content from "../../content.ts";

export function DropZoneWrapperChat({
	children,
	className,
	style,
}: {
	children: ReactNode;
	className?: string;
	style?: React.CSSProperties;
}) {
	const {
		selectUserChatDocument,
		selectedUserChatDocuments,
		unselectUserDocumentForAction,
	} = useUserDocumentStore();

	const handleAddDocumentsToChat = (itemsToAdd: UserDocument[]) => {
		for (const item of itemsToAdd) {
			if (!selectedUserChatDocuments.some((doc) => doc.id === item.id)) {
				selectUserChatDocument(item);
			}
		}
	};

	const [isHoveringOverChat, setIsHoveringOverChat] = useState(false);

	const [, dropRef] = useDrop<UserDocument[], unknown, unknown>({
		accept: "ITEM",
		drop: (draggedItems) => {
			const userDocs = draggedItems.filter(isUserDocument);
			handleAddDocumentsToChat(userDocs);

			for (const doc of userDocs) {
				unselectUserDocumentForAction(doc.id);
			}

			setIsHoveringOverChat(false);
		},
		hover: () => setIsHoveringOverChat(true),
		collect: (monitor) => {
			if (!monitor.isOver()) {
				setIsHoveringOverChat(false);
			}
			return {
				isOver: monitor.isOver(),
			};
		},
	});

	return (
		<section className={`relative ${className}`} style={style} ref={dropRef}>
			<div
				className={`absolute h-full w-full top-0 left-0 right-0 z-20 bg-hellblau-100/90 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-none 
				transition-opacity duration-200 ${isHoveringOverChat ? "opacity-100" : "opacity-0"}`}
			>
				<AddToChatIcon size={48} />

				<span className="font-bold mt-3 text-lg">
					{Content["chat.dropZone.label"]}
				</span>
			</div>

			{children}
		</section>
	);
}
