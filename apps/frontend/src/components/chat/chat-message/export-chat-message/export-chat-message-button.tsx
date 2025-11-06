import React, { useState, useRef } from "react";
import Content from "../../../../content.ts";
import { exportToDocx } from "./utils.ts";
import { format } from "date-fns";
import { ClockLoaderIcon } from "../../../primitives/icons/clock-loader-icon.tsx";
import { ExportButton } from "./export-button.tsx";
import useExportDropdownPosition from "../../hooks/use-export-dropdown-position.ts";
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
	const { coords: dropdownCoords, updateCoords } =
		useExportDropdownPosition(buttonRef);

	const exportDate = format(new Date(), "yyyyMMdd_HHmm");
	const fileName = `${exportDate}_BaerGPT-Chat`;

	const handleToggle = () => {
		setIsDropdownOpen((prev) => {
			if (!prev) {
				updateCoords();
				return true;
			}
			return false;
		});
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
				aria-label={Content["chat.exportChatTextButton.ariaLabel"]}
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

			{/* Dropdown */}
			{isDropdownOpen && (
				<>
					<div
						className="fixed inset-0 z-10"
						onMouseDown={() => setIsDropdownOpen(false)}
					/>
					<div
						className="fixed z-50 bg-white rounded-[3px] shadow-custom-shadow shadow-dunkelblau-100/10 text-sm leading-5 text-dunkelblau-80"
						style={{
							left: dropdownCoords ? `${dropdownCoords.left}px` : undefined,
							top: dropdownCoords ? `${dropdownCoords.top}px` : undefined,
							minWidth: dropdownCoords
								? `${dropdownCoords.minWidth}px`
								: undefined,
						}}
					>
						<ExportButton
							type="docx"
							onClick={handleDocxExport}
							focusButtonRef={buttonRef}
							setIsDropdownOpen={setIsDropdownOpen}
							testId={`export-chat-message-docx-button-${messageId}`}
						/>
						<ExportButton
							type="pdf"
							onClick={handlePDFExport}
							focusButtonRef={buttonRef}
							testId={`export-chat-message-pdf-button-${messageId}`}
							setIsDropdownOpen={setIsDropdownOpen}
						/>
					</div>
				</>
			)}
		</div>
	);
};
