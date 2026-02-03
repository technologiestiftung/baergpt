import React from "react";
import { useDropdownKeyboard } from "../../../../hooks/use-dropdown-keyboard";
import { useDocumentStore } from "../../../../store/document-store";
import type { Document } from "../../../../common";
import Content from "../../../../content";

export type DocumentAction = "addToChat" | "view" | "delete";

interface DocumentDropdownItem {
	action: DocumentAction;
	label: string;
	icon: string;
	ariaLabel: string;
	imgAlt: string;
	isDestructive?: boolean;
}

interface DocumentDropdownProps {
	document: Document;
	isOpen: boolean;
	onClose: () => void;
	className?: string;
}

const dropdownItems: DocumentDropdownItem[] = [
	{
		action: "addToChat",
		label: Content["documentsList.AddToChat"],
		icon: "/icons/plus-dark-blue-icon.svg",
		ariaLabel: "Dokument zum Chat hinzufügen",
		imgAlt: "Plus-Icon",
	},
	{
		action: "view",
		label: "Anzeigen",
		icon: "/icons/visibility-icon.svg",
		ariaLabel: "Dokument anzeigen",
		imgAlt: "Anzeigen-Icon",
	},
	{
		action: "delete",
		label: "Löschen",
		icon: "/icons/bucket-red-icon.svg",
		ariaLabel: "Dokument löschen",
		imgAlt: "Mülleimer-Icon",
		isDestructive: true,
	},
];

export const DocumentDropdown: React.FC<DocumentDropdownProps> = ({
	document,
	isOpen,
	onClose,
	className = "",
}) => {
	const { selectChatDocument, unselectChatDocument, selectedChatDocuments } =
		useDocumentStore();

	const handleActionSelect = (action: DocumentAction) => {
		onClose();

		switch (action) {
			case "addToChat": {
				const isSelected = selectedChatDocuments.some(
					(doc) => doc.id === document.id,
				);
				if (isSelected) {
					unselectChatDocument(document.id);
				} else {
					selectChatDocument(document);
				}
				break;
			}
			case "view":
				// TODO: Implement document view functionality
				break;
			case "delete":
				// TODO: Implement delete confirmation dialog
				break;
			default:
				break;
		}
	};

	const { optionButtonRefs, handleKeyDown } =
		useDropdownKeyboard<DocumentDropdownItem>({
			items: dropdownItems,
			isOpen,
			onClose,
			onItemClick: (item) => handleActionSelect(item.action),
		});

	if (!isOpen) {
		return null;
	}

	return (
		<div
			className={`absolute top-full right-0 mt-1 z-50 bg-white rounded-3px shadow-md min-w-[160px] ${className}`}
			onKeyDown={handleKeyDown}
			role="listbox"
		>
			<ul className="flex flex-col">
				{dropdownItems.map((item, index) => (
					<li key={item.action}>
						<button
							type="button"
							ref={(el) => {
								if (el) {
									optionButtonRefs.current.set(index, el);
								} else {
									optionButtonRefs.current.delete(index);
								}
							}}
							className="flex items-center w-full h-9 px-1.5 py-1 gap-x-2 text-left hover:bg-hellblau-30 focus-visible:outline-default rounded-3px"
							onClick={() => handleActionSelect(item.action)}
							aria-label={item.ariaLabel}
							role="option"
						>
							<div className="flex items-center justify-center rounded-3px shrink-0 size-8">
								<img
									src={item.icon}
									alt={item.imgAlt}
									className="size-5"
									width={20}
									height={20}
								/>
							</div>
							<span
								className={`text-sm leading-5 ${
									item.isDestructive ? "text-warning-100" : "text-dunkelblau-80"
								}`}
							>
								{item.label}
							</span>
						</button>
					</li>
				))}
			</ul>
		</div>
	);
};
