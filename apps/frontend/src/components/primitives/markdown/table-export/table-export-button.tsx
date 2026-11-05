import React, { useRef, useState } from "react";
import { format } from "date-fns";
import Content from "../../../../content.ts";
import { ChatButton } from "../../buttons/chat-button.tsx";
import { ExportButton } from "../../../chat/chat-message/export-chat-message/export-button.tsx";
import { ExportDropdownMenu } from "../../../chat/chat-message/export-chat-message/export-dropdown-menu.tsx";
import { ExportErrorMessage } from "../../../chat/chat-message/export-chat-message/export-error-message.tsx";
import { captureError } from "../../../../monitoring/capture-error.ts";
import { parseTable } from "./parse-table.ts";
import { exportTable, type TableExportFormat } from "./export-table.ts";

interface TableExportButtonProps {
	tableRef: React.RefObject<HTMLTableElement | null>;
}

const FORMATS: TableExportFormat[] = ["xlsx", "csv"];

function readTableRows(table: HTMLTableElement): string[][] {
	return Array.from(table.rows, (row) =>
		Array.from(row.cells, (cell) => cell.textContent ?? ""),
	);
}

export const TableExportButton: React.FC<TableExportButtonProps> = ({
	tableRef,
}) => {
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);
	const [hasExportFailed, setHasExportFailed] = useState(false);
	const buttonRef = useRef<HTMLButtonElement | null>(null);

	const handleExport = async (exportFormat: TableExportFormat) => {
		setIsDropdownOpen(false);
		setHasExportFailed(false);
		if (!tableRef.current) {
			return;
		}
		try {
			const table = parseTable(readTableRows(tableRef.current));
			const fileName = `${format(new Date(), "yyyyMMdd_HHmm")}_BaerGPT-Tabelle`;
			await exportTable(table, exportFormat, fileName);
		} catch (error) {
			captureError(error);
			setHasExportFailed(true);
		}
	};

	return (
		<div className="relative hidden md:flex flex-col gap-1 items-start">
			<ChatButton
				ref={buttonRef}
				className={isDropdownOpen ? "bg-hellblau-50" : ""}
				ariaLabel={Content["chat.exportTableButton.ariaLabel"]}
				onClick={() => setIsDropdownOpen((prev) => !prev)}
				testId="export-table-button"
			>
				<img src="/icons/download-icon.svg" width={20} height={20} alt="" />
				<span>{Content["chat.exportTableButton.label"]}</span>
			</ChatButton>

			{isDropdownOpen && (
				<ExportDropdownMenu
					buttonRef={buttonRef}
					onClose={() => setIsDropdownOpen(false)}
				>
					{FORMATS.map((exportFormat, index) => (
						<ExportButton
							key={exportFormat}
							autoFocus={index === 0}
							label={Content[`chat.exportTableButton.${exportFormat}.label`]}
							ariaLabel={
								Content[`chat.exportTableButton.${exportFormat}.ariaLabel`]
							}
							iconSrc={`/icons/${exportFormat}-file-icon.svg`}
							onClick={() => handleExport(exportFormat)}
							testId={`export-table-${exportFormat}-button`}
						/>
					))}
				</ExportDropdownMenu>
			)}

			{hasExportFailed && (
				<ExportErrorMessage
					message={Content["chat.exportChatTextButton.error"]}
				/>
			)}
		</div>
	);
};
