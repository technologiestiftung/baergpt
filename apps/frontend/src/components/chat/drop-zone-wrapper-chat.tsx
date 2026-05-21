import React, { type ReactNode, useState } from "react";
import { useUserDocumentStore } from "../../store/use-user-document-store.ts";
import type { Document } from "../../common.ts";
import { useDrop } from "react-dnd";
import { AddToChatIcon } from "../primitives/icons/add-to-chat-icon.tsx";

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
		unselectUserChatDocument,
		selectedUserChatDocuments,
	} = useUserDocumentStore();

	const handleAddDocumentToChat = (itemToAddToChat: Document) => {
		if (
			selectedUserChatDocuments.some((doc) => doc.id === itemToAddToChat.id)
		) {
			unselectUserChatDocument(itemToAddToChat.id);
			return;
		}
		selectUserChatDocument(itemToAddToChat);
	};

	const [isHoveringOverChat, setIsHoveringOverChat] = useState(false);

	const [, dropRef] = useDrop({
		accept: "ITEM",
		drop: async (draggedItem: Document) => {
			handleAddDocumentToChat(draggedItem);
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
					Datei ablegen, um BärGPT dazu eine Frage zu stellen
				</span>
			</div>

			{children}
		</section>
	);
}
