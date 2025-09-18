import React from "react";
import Content from "../../../../content";

interface ExportButtonProps {
	type: "docx" | "pdf";
	onClick: () => void;
	focusButtonRef: React.RefObject<HTMLButtonElement>;
	setIsDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
	testId?: string;
}

export const ExportButton: React.FC<ExportButtonProps> = ({
	type,
	onClick,
	focusButtonRef,
	setIsDropdownOpen,
	testId,
}) => (
	<button
		autoFocus
		onKeyDown={(e) => {
			if (e.key === "Escape") {
				setIsDropdownOpen(false);
				focusButtonRef.current?.focus();
			}
		}}
		className={`flex w-full items-center gap-2 px-3 py-1.5 ${
			type === "docx" ? "rounded-t-[3px]" : "rounded-b-[3px]"
		} hover:bg-hellblau-50 focus-visible:outline-default`}
		aria-label={
			type === "docx"
				? Content["chat.exportChatTextButton.docx.ariaLabel"]
				: Content["chat.exportChatTextButton.pdf.ariaLabel"]
		}
		onClick={onClick}
		data-testid={testId}
	>
		{type === "docx" ? (
			<img src="/icons/word-file-icon.svg" alt="" className="size-5" />
		) : (
			<img src="/icons/pdf-file-icon.svg" alt="" className="size-5" />
		)}
		{Content[`chat.exportChatTextButton.${type}.label`]}
	</button>
);
