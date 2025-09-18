import React from "react";
import { QuestionMarkIcon } from "../../primitives/icons/question-mark-icon.tsx";
import { useFolderStore } from "../../../store/folder-store.ts";
import { useDocumentStore } from "../../../store/document-store.ts";
import Content from "../../../content.ts";
import { isDocument } from "../../documents/document-list/list-item/utils/is-document.ts";
import { ListItem } from "../../documents/document-list/list-item/utils/types.ts";
import { useTooltipStore } from "../../../store/tooltip-store.ts";

export function SelectedChatItemsLabel() {
	const { selectedChatFolders } = useFolderStore();
	const { selectedChatDocuments } = useDocumentStore();
	const { showTooltip, hideTooltip } = useTooltipStore();

	const selectedChatItems = [...selectedChatFolders, ...selectedChatDocuments];
	const selectedChatItemsAmount = selectedChatItems.length;
	const hasSelectedChatItems = selectedChatItemsAmount > 0;

	const handleShowTooltip = (
		event: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>,
	) => {
		showTooltip({
			event,
			content: Content["chat.selectedChatItems.questionmark.tooltip"],
			width: "13rem",
		});
	};

	const handleShowTooltipMobile = (
		event: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>,
	) => {
		showTooltip({
			event,
			content: Content["chat.selectedChatItems.questionmark.tooltip"],
			width: "13rem",
			offset: { top: -60, right: -120 },
		});
	};

	return (
		<>
			{!hasSelectedChatItems && (
				<>
					<span className="flex gap-x-1 items-center">
						{Content["chat.selectedChatItems.noItems"]}
						{/* Mobile tooltip trigger */}
						<div
							aria-label={
								Content["chat.selectedChatItems.questionmark.tooltip"]
							}
							onMouseEnter={handleShowTooltipMobile}
							onMouseLeave={hideTooltip}
							onFocus={handleShowTooltipMobile}
							onBlur={hideTooltip}
							tabIndex={0}
							className="cursor-pointer focus-visible:outline-default md:hidden"
						>
							<QuestionMarkIcon variant="blue" />
						</div>
						{/* Desktop tooltip trigger */}
						<div
							aria-label={
								Content["chat.selectedChatItems.questionmark.tooltip"]
							}
							onMouseEnter={handleShowTooltip}
							onMouseLeave={hideTooltip}
							onFocus={handleShowTooltip}
							onBlur={hideTooltip}
							tabIndex={0}
							className="cursor-pointer focus-visible:outline-default hidden md:block"
						>
							<QuestionMarkIcon variant="blue" />
						</div>
					</span>
				</>
			)}

			{hasSelectedChatItems && (
				<span className="text-sm leading-5 text-dunkelblau-100">
					<span className="font-semibold px-0.5">
						{selectedChatItemsAmount}
					</span>{" "}
					{getSelectedItemsLabel(selectedChatItems)}
				</span>
			)}
		</>
	);
}

function getSelectedItemsLabel(selectedItems: ListItem[]) {
	if (selectedItems.length > 1) {
		return Content["chat.selectedChatItems.items"];
	}

	const item = selectedItems[0];
	if (isDocument(item)) {
		return Content["chat.selectedChatItems.document"];
	}

	return Content["chat.selectedChatItems.folder"];
}
