import React, { useState, useRef } from "react";
import Content from "../../../../content.ts";
import { exportToDocx } from "./utils.ts";
import { format } from "date-fns";
import { ClockLoaderIcon } from "../../../primitives/icons/clock-loader-icon.tsx";
import { ExportButton } from "./export-button.tsx";
import { ExportDropdownMenu } from "./export-dropdown-menu.tsx";
import { ChatButton } from "../../../primitives/buttons/chat-button.tsx";

interface ExportChatMessageButtonProps {
	generatedAnswer: string;
	messageId?: number;
}

export const ExportChatMessageButton: React.FC<
	ExportChatMessageButtonProps
> = ({ generatedAnswer, messageId }) => {
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);
	const [isExporting, setIsExporting] = useState(false);
	const buttonRef = useRef<HTMLButtonElement | null>(null);

	const exportDate = format(new Date(), "yyyyMMdd_HHmm");
	const fileName = `${exportDate}_BaerGPT-Chat`;

	const handleToggle = () => {
		setIsDropdownOpen((prev) => !prev);
	};

	const handleDocxExport = async () => {
		setIsExporting(true);
		setIsDropdownOpen(false);

		await exportToDocx(generatedAnswer, fileName);

		// Reset isExporting after 1s (animation duration)
		setTimeout(() => {
			setIsExporting(false);
		}, 1000);
	};

	const handlePDFExport = async () => {
		setIsExporting(true);
		setIsDropdownOpen(false);

		const { exportMarkdownToPdf } = await import("./pdf-export.tsx");
		await exportMarkdownToPdf(generatedAnswer, fileName);

		setTimeout(() => {
			setIsExporting(false);
		}, 1000);
	};

	return (
		<div className="relative hidden md:flex flex-col">
			{/* Trigger button */}
			<ChatButton
				testId={`export-chat-message-button-${messageId}`}
				ref={buttonRef}
				className={`flex gap-0.5 rounded-[3px] pr-1.5 p-1 w-fit hover:bg-hellblau-50 focus-visible:outline-default text-sm leading-5 text-dunkelblau-80 ${
					isDropdownOpen && "bg-hellblau-50"
				}`}
				ariaLabel={Content["chat.exportChatTextButton.ariaLabel"]}
				onClick={handleToggle}
			>
				{isExporting ? (
					<>
						<ClockLoaderIcon />
						<span className="text-dunkelblau-40">
							{Content["chat.exportChatTextButton.exporting.label"]}
						</span>
					</>
				) : (
					<>
						<img src="/icons/export-icon.svg" width={20} height={20} alt="" />
						<span>{Content["chat.exportChatTextButton.label"]}</span>
					</>
				)}
			</ChatButton>

			{isDropdownOpen && (
				<ExportDropdownMenu
					buttonRef={buttonRef}
					onClose={() => setIsDropdownOpen(false)}
				>
					<ExportButton
						autoFocus
						label={Content["chat.exportChatTextButton.docx.label"]}
						ariaLabel={Content["chat.exportChatTextButton.docx.ariaLabel"]}
						iconSrc="/icons/word-file-icon.svg"
						onClick={handleDocxExport}
						testId={`export-chat-message-docx-button-${messageId}`}
					/>
					<ExportButton
						label={Content["chat.exportChatTextButton.pdf.label"]}
						ariaLabel={Content["chat.exportChatTextButton.pdf.ariaLabel"]}
						iconSrc="/icons/pdf-file-icon.svg"
						onClick={handlePDFExport}
						testId={`export-chat-message-pdf-button-${messageId}`}
					/>
				</ExportDropdownMenu>
			)}
		</div>
	);
};
